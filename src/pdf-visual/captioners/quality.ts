// `quality` visual-quality profile — Qwen3.5-2B.
//
// Non-obvious constraints:
//   - The `-ONNX-OPT` export of this model needs an ORT contrib op
//     (`com.microsoft:CausalConvWithState`) that onnxruntime-node does not
//     register, so the plain `-ONNX` repo is the only loadable one here.
//   - Generation options were picked by measurement over a figure fixture set:
//     a stronger `repetition_penalty` (1.15, as `fast` uses) makes this family
//     invent label variants, and `no_repeat_ngram_size: 3` costs recall,
//     because a figure legitimately repeats short phrases.
//   - Keywords precede the summary because `postProcess` truncates the tail,
//     and the tail is where an exhausted run degenerates.

import { AutoProcessor, Qwen3_5ForConditionalGeneration } from '@huggingface/transformers'

import type { Captioner } from '../types.js'
import { VlmError } from '../types.js'
import { QUALITY_PROMPT } from './prompts.js'
import {
  asVlmModel,
  asVlmProcessor,
  capLongEdge,
  createModelLoader,
  decodePngToRawImage,
  postProcess,
} from './shared.js'

const MODEL_NAME = 'onnx-community/Qwen3.5-2B-ONNX'

/**
 * Input long-edge cap (px). The image processor does not downscale on its own,
 * so this is what bounds per-page CPU time. Measured: 768 loses small in-figure
 * text, 1280 costs ~20% more time for no recall gain.
 */
const INPUT_LONG_EDGE = 1024

/**
 * Create a `quality` profile captioner. The dispatcher has already configured
 * `env.cacheDir`; this profile only owns lazy model loading and inference.
 */
export function createQualityCaptioner(resolvedDevice: string): Captioner {
  const loader = createModelLoader(MODEL_NAME, resolvedDevice, async ({ dtypeOpt, modelOpt }) => {
    const processor = await AutoProcessor.from_pretrained(MODEL_NAME, dtypeOpt)
    const model = await Qwen3_5ForConditionalGeneration.from_pretrained(MODEL_NAME, modelOpt)
    return { processor, model }
  })

  return {
    dispose: loader.dispose,
    async caption(pngBytes: Uint8Array, pageNum: number): Promise<string | null> {
      try {
        const { processor, model } = await loader.ensureLoaded()

        const rawImage = await capLongEdge(await decodePngToRawImage(pngBytes), INPUT_LONG_EDGE)

        const messages = [
          {
            role: 'user',
            content: [{ type: 'image' }, { type: 'text', text: QUALITY_PROMPT }],
          },
        ]
        // Qwen3.5 takes a single image, not an array.
        const proc = asVlmProcessor(processor)
        const mdl = asVlmModel(model)

        const chatPrompt = proc.apply_chat_template(messages, { add_generation_prompt: true })
        const inputs = await proc(chatPrompt, rawImage)

        const outputs = await mdl.generate({
          ...inputs,
          max_new_tokens: 160,
          no_repeat_ngram_size: 6,
          repetition_penalty: 1.05,
          // The model ships `do_sample: true`, which would make captions for
          // the same page differ between ingests.
          do_sample: false,
        })

        const inputLen = inputs.input_ids.dims.at(-1)
        if (typeof inputLen !== 'number') {
          throw new VlmError('Captioner returned an input tensor without a token dimension', {
            pageNum,
          })
        }
        const newTokens = outputs.slice(null, [inputLen, null])

        const decoded = proc.batch_decode(newTokens, { skip_special_tokens: true })
        const text = decoded[0] ?? ''

        return postProcess(text)
      } catch (err) {
        if (err instanceof VlmError) {
          throw err
        }
        const cause = err instanceof Error ? err : new Error(String(err))
        throw new VlmError(`Captioning failed for page ${pageNum}`, { cause, pageNum })
      }
    },
  }
}
