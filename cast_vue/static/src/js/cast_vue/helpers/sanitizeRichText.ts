import createDOMPurify, { type Config } from 'dompurify';

// Keep this instance private: hooks must not change other DOMPurify consumers.
const purifier = createDOMPurify(window);
const config: Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'hr', 'a', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'sup', 'sub',
    'mark', 'q', 'cite', 'abbr', 'small', 'kbd', 'samp', 'var',
    'blockquote', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'pre',
    'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'div', 'span', 'article', 'section', 'figure', 'figcaption',
    'picture', 'img', 'audio', 'video', 'source', 'track', 'iframe',
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'rel', 'id', 'class', 'src', 'alt', 'srcset', 'sizes',
    'width', 'height', 'loading', 'decoding', 'controls', 'preload', 'poster',
    'loop', 'muted', 'playsinline', 'type', 'kind', 'srclang', 'label', 'default',
    'colspan', 'rowspan', 'scope', 'span', 'border',
    'allow', 'allowfullscreen', 'frameborder', 'referrerpolicy',
    'data-fullsrc', 'data-srcset', 'data-modal-src', 'data-modal-srcset',
    'data-modal-sizes', 'data-modal-width', 'data-modal-height', 'data-prev', 'data-next',
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: true,
};

// Video players that Wagtail's EmbedBlock renders as iframes. Any other frame
// source is dropped together with its element.
const EMBED_HOSTS = new Set([
  'www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com',
]);
const FRAME_ONLY_ATTRS = new Set(['allow', 'allowfullscreen', 'frameborder', 'referrerpolicy']);

function safeUrl(value: string, link = false): boolean {
  try {
    const protocol = new URL(value, 'https://cast.invalid/').protocol;
    return ['http:', 'https:', ...(link ? ['mailto:', 'tel:'] : [])].includes(protocol);
  } catch {
    return false;
  }
}

function safeEmbedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && EMBED_HOSTS.has(url.hostname) && !url.port;
  } catch {
    return false;
  }
}

purifier.addHook('uponSanitizeAttribute', (node, attribute) => {
  const { attrName, attrValue } = attribute;
  const isFrame = node.nodeName === 'IFRAME';
  if (FRAME_ONLY_ATTRS.has(attrName) && !isFrame) {
    attribute.keepAttr = false;
  } else if (attrName === 'src' && isFrame) {
    attribute.keepAttr = safeEmbedUrl(attrValue);
  } else if (['href', 'src', 'poster', 'data-fullsrc', 'data-modal-src'].includes(attrName)) {
    attribute.keepAttr = safeUrl(attrValue, attrName === 'href');
  } else if (['srcset', 'data-srcset', 'data-modal-srcset'].includes(attrName)) {
    // Cast emits comma-separated file URLs with optional width/density descriptors.
    // Data URLs are deliberately unsupported, including inside candidate lists.
    attribute.keepAttr = attrValue.split(',').every(candidate =>
      safeUrl(candidate.trim().split(/\s+/)[0])
    );
  }
});

purifier.addHook('afterSanitizeAttributes', node => {
  // A frame without an allowed embed source would load about:blank; drop it.
  if (node.nodeName === 'IFRAME' && !node.hasAttribute('src')) {
    node.remove();
  }
});

/** Sanitize API HTML last, after any component-specific DOM transformations. */
export function sanitizeRichText(html: string | null | undefined): string {
  return purifier.sanitize(html ?? '', config);
}
