export function convertCaretTabs(input: string): { tabs: string; lineBreaks: string } {
  return {
    tabs: input.replace(/\^I/g, '\t'),
    lineBreaks: input.replace(/\^I/g, '\n'),
  };
}
