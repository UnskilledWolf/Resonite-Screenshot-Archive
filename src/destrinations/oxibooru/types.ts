export type safetyLevels = 'safe' | 'sketchy' | 'unsafe';

export type uploadPostResponse = {
  token: string;
};

export type validatePostResponse = {
  exactPost: null | string;
  similarPosts: string[];
};

export type getTagResponse = {
  version: Date;
  description: string;
  creationTime: Date;
  lastEditTime: Date;
  category: string;
  names: string[];
  implications: string[];
  suggestions: string[];
  usages: string;
};

export type getTagSearchResponse = {
  query: string;
  offset: number;
  limit: number;
  total: number;
  results: {
    version?: Date;
    description?: string;
    creationTime?: Date;
    lastEditTime?: Date;
    category?: string;
    names: string[];
    implications?: string[];
    suggestions?: string[];
    usages?: string;
  }[];
};

export type getPostSearchResponse = {
  query: string;
  offset: number;
  limit: number;
  total: number;
  results: {
    version?: Date;
    description?: string;
    creationTime?: Date;
    lastEditTime?: Date;
    category?: string;
    tags?: {
      names: string[];
      category: string;
      usages: number;
    }[];
    id?: number;
    implications?: string[];
    suggestions?: string[];
    usages?: string;
  }[];
};

export type getTagCategoriesResponse = {
  results: {
    version: Date;
    name: string;
    color: string;
    usages: number;
    order: number;
    default: boolean;
  }[];
};
