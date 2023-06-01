export function getTexContentFromElement(
  elementId: string,
  htmlString?: string
): string {
  let dom;
  if (htmlString) {
    const parser = new DOMParser();
    dom = parser.parseFromString(htmlString, "text/html");
  } else {
    dom = document;
  }

  const element = dom.getElementById(elementId);
  if (element === null || element.textContent === null) {
    throw new Error(`Element with id ${elementId} not found`);
  }
  return JSON.parse(element.textContent);
}
