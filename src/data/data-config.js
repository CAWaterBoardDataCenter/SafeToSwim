export const DATASETS = [
  {
    id: "15a63495-8d9f-4a49-b43a-3092ef3106b9",
    priority: 1,              // 1 = highest (default at startup)
    label: "2020–present"
  },
  {
    id: "04d98c22-5523-4cc1-86e7-3a6abf40bb60",
    priority: 2,
    label: "2010–2020"
  },
  {
    id: "1d333989-559a-433f-b93f-bb43d21da2b9",
    priority: 3,
    label: "before 2010"
  }
];

export const DEFAULT_RESOURCE_ID =
  DATASETS.sort((a, b) => a.priority - b.priority)[0].id;
