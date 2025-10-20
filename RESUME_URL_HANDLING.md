# Resume URL Handling - View vs Download

## Problem and Solution ✅

**Issue**: Cloudinary `raw` resource type URLs force file downloads instead of allowing inline PDF viewing.

**Reality**: Cloudinary's `raw` resource type is designed for security and always forces downloads for document files.

**Practical Solution**: Use the same URL but handle viewing vs downloading behavior on the frontend.

## URL Structure

### Single URL for Multiple Uses
```
https://res.cloudinary.com/workbridg/raw/upload/v.../resumes/resume_...
```

**Behavior**: 
- **Direct access**: Forces download (Cloudinary security feature)
- **Frontend handling**: Can be used for both viewing and downloading

**Note**: Modern browsers can handle PDF viewing when the URL is embedded properly in frontend components.

## API Response Format

```json
{
  "statusCode": 200,
  "data": {
    "viewUrl": "https://res.cloudinary.com/workbridg/raw/upload/v.../resumes/resume_...",
    "downloadUrl": "https://res.cloudinary.com/workbridg/raw/upload/v.../resumes/resume_...",
    "originalUrl": "https://res.cloudinary.com/workbridg/raw/upload/v.../resumes/resume_...",
    "publicId": "resumes/resume_userId_timestamp",
    "originalName": "Resume_Garvit.pdf",
    "size": 579670
  },
  "message": "File uploaded successfully",
  "success": true
}
```

**Note**: All URLs are the same - the difference is in how you use them in the frontend.

## Frontend Implementation Examples

### PDF Viewer with Download Button

```jsx
function ResumeViewer({ resumeData }) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = resumeData.viewUrl;
    link.download = resumeData.originalName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="resume-viewer">
      {/* PDF Preview - Note: May still download due to Cloudinary's raw type */}
      <iframe 
        src={resumeData.viewUrl}
        width="100%" 
        height="600px"
        title="Resume Preview"
      />
      
      {/* Download Button */}
      <button onClick={handleDownload} className="download-btn">
        📥 Download {resumeData.originalName}
      </button>
    </div>
  );
}
```

### PDF.js Integration

```jsx
import { Document, Page } from 'react-pdf';

function PDFViewer({ resumeData }) {
  return (
    <div>
      <Document file={resumeData.viewUrl}>
        <Page pageNumber={1} />
      </Document>
      
      <a 
        href={resumeData.downloadUrl} 
        download={resumeData.originalName}
        className="download-link"
      >
        Download Resume
      </a>
    </div>
  );
}
```

### Simple Link Options

```jsx
function ResumeLinks({ resumeData }) {
  return (
    <div className="resume-actions">
      {/* View in new tab */}
      <a 
        href={resumeData.viewUrl} 
        target="_blank" 
        rel="noopener noreferrer"
      >
        👁️ View Resume
      </a>
      
      {/* Download directly */}
      <a 
        href={resumeData.downloadUrl}
        download={resumeData.originalName}
      >
        📥 Download Resume
      </a>
    </div>
  );
}
```

## File Type Support

### ✅ **PDFs**
- **View**: Opens inline in browser
- **Download**: Downloads with original filename

### ✅ **DOC/DOCX**
- **View**: Browser will attempt to display or prompt for app
- **Download**: Downloads with original filename
- **Note**: Most browsers can't display DOC/DOCX inline

## Database Storage

- **User Model**: Stores `viewUrl` in `user.resume` field
- **Reason**: Optimized for inline display in user profiles
- **Access**: Frontend can request full URL set via API when needed

## Migration Notes

### From Raw URLs
If you have existing `raw` resource type URLs, they will still work but force downloads. New uploads will use the improved `image` resource type.

### URL Compatibility
All three URL types point to the same file - just with different viewing behaviors.

## Best Practices

1. **Use `viewUrl`** for PDF previews and inline display
2. **Use `downloadUrl`** for explicit download buttons
3. **Use `originalUrl`** as fallback if others fail
4. **Store `viewUrl`** in database for optimal user experience
5. **Provide both view and download options** in UI for best UX

This solution gives you maximum flexibility for both viewing and downloading resumes! 🎯
