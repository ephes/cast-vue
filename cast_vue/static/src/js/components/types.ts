export interface Post {
    id: number;
    title: string;
    meta: {
        type: string;
        detail_url: string;
        html_url: string;
        slug: string;
        first_published_at: string;
    };
}


export interface PostsFromApi {
    meta: {
        total_count: number;
    };
    items: [Post];
}
  