// Official LNReader isUrlAbsolute implementation
export const isUrlAbsolute = (url: string) => {
    if (url) {
        if (url.indexOf('//') === 0) {
            return true;
        }
        if (url.indexOf('://') === -1) {
            return false;
        }
        if (url.indexOf('.') === -1) {
            return false;
        }
        if (url.indexOf('/') === -1) {
            return false;
        }
        if (url.indexOf(':') > url.indexOf('/')) {
            return false;
        }
        if (url.indexOf('://') < url.indexOf('.')) {
            return true;
        }
    }
    return false;
};
