// Official LNReader Constants
export const NovelStatus = {
    Unknown: 'Unknown',
    Ongoing: 'Ongoing',
    Completed: 'Completed',
    Licensed: 'Licensed',
    PublishingFinished: 'Publishing Finished',
    Cancelled: 'Cancelled',
    OnHiatus: 'On Hiatus',
    STUB: 'STUB',
    Inactive: 'Inactive',
} as const;

export const ShowStatus = {
    All: 'All',
    Ongoing: 'Ongoing',
    Completed: 'Completed'
} as const;

export const defaultCover =
    'https://github.com/LNReader/lnreader-plugins/blob/main/icons/src/coverNotAvailable.jpg?raw=true';
