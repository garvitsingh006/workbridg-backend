const asyncHandler = (func) => {
    return (req, res, next) => {
        Promise.resolve(func(req,res,next)).catch((error) => {
            const statusCode = Number.isInteger(error.code) ? error.code : 500;
            res.status(statusCode).json({message: error.message || "Internal Server Error", success: false})
        })
    }
}

export {asyncHandler}