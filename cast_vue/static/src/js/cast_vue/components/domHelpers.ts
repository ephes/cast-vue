export function getTexContentFromElement(elementId: string): string {
    const element = document.getElementById(elementId);
    if (element === null || element.textContent === null) {
        throw new Error(`Could not find element with id "${elementId}"`);
    }
    return JSON.parse(element.textContent);
}

export function getWagtailApiBaseUrl(): URL {
    const blogPk = getTexContentFromElement("blog-pk");
    const wagtailApiUrlString = getTexContentFromElement("wagtail-api-pages-url");
    const wagtailApiUrl = new URL(wagtailApiUrlString);
    wagtailApiUrl.searchParams.set("child_of", blogPk);
    return wagtailApiUrl;
}
