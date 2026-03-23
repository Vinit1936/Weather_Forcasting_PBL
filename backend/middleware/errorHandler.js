function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const isDev = process.env.NODE_ENV === 'development';

  return res.status(statusCode).json({
    success: false,
    message,
    data: null,
    ...(isDev ? { stack: err.stack } : {}),
  });
}

module.exports = errorHandler;
