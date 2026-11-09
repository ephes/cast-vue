import createDOMPurify, { type Config } from 'dompurify';

// Keep this instance private: hooks must not change other DOMPurify consumers.
const purifier = createDOMPurify(window);
const config: Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'hr', 'a', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'sup', 'sub',
    'blockquote', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'pre',
    'div', 'span', 'article', 'section', 'figure', 'figcaption',
    'picture', 'img', 'audio', 'video', 'source', 'track',
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'rel', 'id', 'class', 'src', 'alt', 'srcset', 'sizes',
    'width', 'height', 'loading', 'decoding', 'controls', 'preload', 'poster',
    'loop', 'muted', 'playsinline', 'type', 'kind', 'srclang', 'label', 'default',
    'data-fullsrc', 'data-srcset', 'data-modal-src', 'data-modal-srcset',
    'data-modal-sizes', 'data-modal-width', 'data-modal-height', 'data-prev', 'data-next',
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
};

function safeUrl(value: string, link = false): boolean {
  try {
    const protocol = new URL(value, 'https://cast.invalid/').protocol;
    return ['http:', 'https:', ...(link ? ['mailto:', 'tel:'] : [])].includes(protocol);
  } catch {
    return false;
  }
}

purifier.addHook('uponSanitizeAttribute', (_node, attribute) => {
  const { attrName, attrValue } = attribute;
  if (['href', 'src', 'poster', 'data-fullsrc', 'data-modal-src'].includes(attrName)) {
    attribute.keepAttr = safeUrl(attrValue, attrName === 'href');
  } else if (['srcset', 'data-srcset', 'data-modal-srcset'].includes(attrName)) {
    // Cast emits comma-separated file URLs with optional width/density descriptors.
    // Data URLs are deliberately unsupported, including inside candidate lists.
    attribute.keepAttr = attrValue.split(',').every(candidate =>
      safeUrl(candidate.trim().split(/\s+/)[0])
    );
  }
});

/** Sanitize API HTML last, after any component-specific DOM transformations. */
export function sanitizeRichText(html: string | null | undefined): string {
  return purifier.sanitize(html ?? '', config);
}
