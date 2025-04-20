/**
 * Utility functions for handling images in the canvas
 */

/**
 * Converts object URLs to base64 in a canvas object
 */
export const convertImageUrlsToBase64 = async (canvas: any): Promise<any> => {
    if (!canvas || !canvas.elements) return canvas;
    
    // Create a deep copy to avoid modifying the original
    const canvasCopy = JSON.parse(JSON.stringify(canvas));
    
    // Process all image elements
    for (const element of canvasCopy.elements) {
      if (element.type === 'image' && element.imageUrl) {
        // Check if it's an object URL (starts with blob:)
        if (element.imageUrl.startsWith('blob:')) {
          try {
            // Convert object URL to base64
            const response = await fetch(element.imageUrl);
            const blob = await response.blob();
            
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            
            element.imageUrl = await base64Promise;
            console.log('Converted object URL to base64 for element:', element.id);
          } catch (error) {
            console.error('Failed to convert image URL to base64:', error);
          }
        }
      }
    }
    
    return canvasCopy;
  };
  
  /**
   * Creates a compressed, resized image from a file and returns as base64
   */
  export const createCompressedImageBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Scale large images down to max dimensions
          const maxDimension = 1200;
          let { width, height } = img;
          
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          
          // Create a canvas to compress the image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Could not get canvas context'));
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Return as base64 directly
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = reject;
        img.src = event.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };