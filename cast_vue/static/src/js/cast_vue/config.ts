const {
  blogUrl = "/",
  csrfToken = "",
  blogId = null,
  paginationPageSize = "5",
  wagtailApiPagesUrl = "/",
  apiFacetCountsUrl = "/",
  postCommentUrl = "/",
  vueRouteName = "PostList",
  postSlug = "",
  pageType = "",
  apiThemeListUrl = "/",
  apiThemeUpdateUrl = "/",
  apiPodlovePlayerConfigUrl= "/",
  styleguideUrl = "",
} = document.getElementById("vue-configuration")?.dataset ?? {};

let parsedBlogId = null;

if (blogId) {
  parsedBlogId = parseInt(blogId);
  if (isNaN(parsedBlogId)) {
    throw new Error(`Invalid blogId: ${blogId}`);
  }
} else {
    throw new Error("Missing blogId");
}

const blogDetailUrl = new URL(`${wagtailApiPagesUrl}${parsedBlogId}/`);
blogDetailUrl.searchParams.set("type", "cast.Blog");

const postListUrl = new URL(wagtailApiPagesUrl);
postListUrl.searchParams.set("child_of", parsedBlogId.toString());

const parsedPaginationPageSize = parseInt(paginationPageSize);

if (isNaN(parsedPaginationPageSize)) {
    throw new Error(`Invalid paginationPageSize: ${paginationPageSize}`);
}

const parsedApiFacetCountsUrl = new URL(apiFacetCountsUrl);
const parsedPostCommentUrl = new URL(postCommentUrl);
const routerBase = pageType === "styleguide" && styleguideUrl ? styleguideUrl : blogUrl;
const styleguideDataElement = document.getElementById("cast-vue-styleguide-data");
let styleguideData = null;
if (styleguideDataElement?.textContent) {
  styleguideData = JSON.parse(styleguideDataElement.textContent);
}

export default {
  blogUrl,
  csrfToken,
  blogId: parsedBlogId,
  paginationPageSize: parsedPaginationPageSize,
  wagtailApiPagesUrl,
  apiFacetCountsUrl: parsedApiFacetCountsUrl,
  postCommentUrl: parsedPostCommentUrl,
  apiPodlovePlayerConfigUrl: new URL(apiPodlovePlayerConfigUrl),
  apiThemeListUrl: new URL(apiThemeListUrl),
  apiThemeUpdateUrl: new URL(apiThemeUpdateUrl),
  blogDetailUrl,
  postListUrl,
  vueRouteName,
  postSlug,
  pageType,
  routerBase,
  styleguideUrl,
  styleguideData,
};
