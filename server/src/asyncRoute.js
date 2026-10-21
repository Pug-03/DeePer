// Express 4 doesn't catch a rejected promise from an async handler: the
// request hangs and the rejection goes unhandled. Wrapping the handler sends
// the error to the app's JSON error handler instead, like a sync throw.
export const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
