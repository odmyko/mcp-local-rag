export const QUALITY_PROMPT = `This image is a figure region cropped from a PDF page. Write search text for it.

Output two lines, in this order:

Line 1 starts with "Keywords:" and then lists the phrases, separated by semicolons.
Line 2 starts with "Summary:" and then holds one sentence.

Keywords rules:
- Copy the text that is legible in the image: titles, axis names, legend entries, row and column names, panel labels, annotations, diagram node and step names, and numbers shown as labels.
- Use the exact wording from the image.
- Keep a number with the label it belongs to, printed as shown, including decimal points and units.
- Every part of the image that carries legible text contributes at least one phrase.
- List each phrase once.
- For partly legible text, keep the part you can read.
- For a table, keep its title, row names and column names; leave the cell-by-cell values out.
- Once the legible labels are listed, write the Summary line and stop.

Summary rule:
- One sentence naming the figure type and its subject.

Ground every phrase and the summary in what is visible. Where a region carries no legible text, describe it in the summary instead of supplying words for it.`
