# Test Resume Upload Endpoint

## Test with cURL

```bash
# Replace YOUR_JWT_TOKEN with actual token
curl -X POST \
  http://localhost:8000/api/v1/upload/resume \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@path/to/your/resume.pdf" \
  -v

# Test Cloudinary connection
curl -X GET \
  http://localhost:8000/api/v1/upload/test-cloudinary \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -v
```

## Test with Postman

1. **Method**: POST
2. **URL**: `http://localhost:8000/api/v1/upload/resume`
3. **Headers**: 
   - `Authorization: Bearer YOUR_JWT_TOKEN`
4. **Body**: 
   - Type: `form-data`
   - Key: `file` (type: File)
   - Value: Select your resume file

## Expected Response

```json
{
  "statusCode": 200,
  "data": {
    "url": "https://res.cloudinary.com/workbridg/raw/upload/v.../resumes/resume_...",
    "publicId": "resumes/resume_userId_timestamp",
    "originalName": "Resume_Garvit.pdf",
    "size": 579670
  },
  "message": "File uploaded successfully",
  "success": true
}
```

## Debug Steps

1. Check if you're getting the middleware logs in sequence
2. Verify the JWT token is valid
3. Ensure the file is being sent correctly
4. Check network tab in browser for actual HTTP response
