// // Using Try Catch
// const asyncHandler = (func) = async (req, res, next) => {
//     try {
//         await func(req, res, next)
//     } catch (error) {
//         res.status(error.code || 500).json({message: error.message || "Internal Server Error", success: false})
//     }
// }

// Using Promises
const asyncHandler = (func) => {
    return (req, res, next) => {
        Promise.resolve(func(req,res,next)).catch((error) => {
            res.status(error.code || 500).json({message: error.message || "Internal Server Error", success: false})
        })
    }
}

export {asyncHandler}