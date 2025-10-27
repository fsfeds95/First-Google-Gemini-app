import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateImage } from '../services/geminiService';
import { ImageGenerationConfig, HistoryItem } from '../types';

const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize state from localStorage or use defaults
  const [aspectRatio, setAspectRatio] = useState<ImageGenerationConfig['aspectRatio']>(
    () => (localStorage.getItem('aspectRatio') as ImageGenerationConfig['aspectRatio']) || '1:1'
  );
  const [imageStyle, setImageStyle] = useState<string>(
    () => localStorage.getItem('imageStyle') || 'default'
  );
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const savedHistory = localStorage.getItem('history');
      return savedHistory ? JSON.parse(savedHistory) : [];
    } catch (e) {
      console.error("Failed to parse history from localStorage", e);
      return [];
    }
  });

  const [referenceImage, setReferenceImage] = useState<{ url: string; data: string; mimeType: string; } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // useEffect hooks to save state to localStorage on change
  useEffect(() => {
    localStorage.setItem('aspectRatio', aspectRatio);
  }, [aspectRatio]);

  useEffect(() => {
    localStorage.setItem('imageStyle', imageStyle);
  }, [imageStyle]);

  useEffect(() => {
    localStorage.setItem('history', JSON.stringify(history));
  }, [history]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const result = loadEvent.target?.result as string; // data:image/jpeg;base64,...
        const [meta, base64Data] = result.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];
        setReferenceImage({
          url: result,
          data: base64Data,
          mimeType: mimeType,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateImage = useCallback(async (options?: { p: string, ar: ImageGenerationConfig['aspectRatio'], is: string, refImgUrl?: string }) => {
    const currentPrompt = options ? options.p : prompt;
    const currentAspectRatio = options ? options.ar : aspectRatio;
    const currentImageStyle = options ? options.is : imageStyle;
    const currentRefImage = options?.refImgUrl ? referenceImage : referenceImage;

    if (!currentPrompt.trim()) {
      setError("Please enter a prompt to generate an image.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImageUrl(null);

    const finalPrompt = currentImageStyle === 'default'
      ? currentPrompt
      : `${currentPrompt}, in a ${currentImageStyle} style`;

    const config: ImageGenerationConfig = {
      prompt: finalPrompt,
      numberOfImages: 1,
      outputMimeType: 'image/jpeg',
      aspectRatio: currentAspectRatio,
    };

    if (currentRefImage) {
      config.referenceImage = {
        data: currentRefImage.data,
        mimeType: currentRefImage.mimeType,
      };
    }

    try {
      const imageUrl = await generateImage(config);
      setGeneratedImageUrl(imageUrl);
      const newHistoryItem: HistoryItem = {
        imageUrl,
        prompt: currentPrompt,
        aspectRatio: currentAspectRatio,
        imageStyle: currentImageStyle,
        referenceImageUrl: currentRefImage?.url,
      };
      setHistory(prev => [newHistoryItem, ...prev.filter(item => item.imageUrl !== imageUrl).slice(0, 19)]);
    } catch (err: any) {
      console.error("Image generation failed:", err);
      setError(err.message || "Failed to generate image. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [prompt, aspectRatio, imageStyle, referenceImage]);

  const handleDownloadImage = useCallback(() => {
    if (!generatedImageUrl) return;
    const link = document.createElement('a');
    link.href = generatedImageUrl;
    const filename = prompt.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 50) || 'gemini-generated-image';
    link.download = `${filename}.jpeg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generatedImageUrl, prompt]);

  const handleViewHistoryImage = useCallback((item: HistoryItem) => {
    setGeneratedImageUrl(item.imageUrl);
    setPrompt(item.prompt);
    setAspectRatio(item.aspectRatio);
    setImageStyle(item.imageStyle);
    if (item.referenceImageUrl) {
      const [meta, base64Data] = item.referenceImageUrl.split(',');
      const mimeType = meta.split(':')[1].split(';')[0];
      setReferenceImage({
        url: item.referenceImageUrl,
        data: base64Data,
        mimeType: mimeType,
      });
    } else {
      setReferenceImage(null);
    }
  }, []);

  const handleDeleteHistoryItem = useCallback((indexToDelete: number) => {
    setHistory(prev => prev.filter((_, index) => index !== indexToDelete));
  }, []);

  const triggerFileSelect = () => fileInputRef.current?.click();

  return (
    <div className="w-full flex flex-col relative">
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-20 md:rounded-lg">
          <div className="text-center text-white p-4">
            <svg aria-hidden="true" className="inline w-10 h-10 text-gray-200 animate-spin dark:text-gray-600 fill-indigo-500" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
              <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0492C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill"/>
            </svg>
            <p className="mt-4 text-xl font-semibold">Creando tu obra maestra...</p>
            <p className="text-sm text-gray-300">Esto puede tardar unos momentos.</p>
          </div>
        </div>
      )}
      <div className="w-full flex flex-col md:flex-row">
        {/* Input and Controls Section */}
        <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-800 md:w-1/2 flex flex-col justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-4 md:mb-6">
              Gemini Image Generator
            </h1>
            <div className="flex-grow">
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Image Prompt
              </label>
              <textarea
                id="prompt"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 resize-y min-h-[120px] placeholder:text-gray-400 dark:placeholder:text-gray-500"
                rows={5}
                placeholder="e.g., A futuristic city at sunset with flying cars and towering skyscrapers."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isLoading}
              ></textarea>
              
              {/* Reference Image Section */}
              <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Reference Image (Optional)
                  </label>
                  <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept="image/png, image/jpeg, image/webp"
                      disabled={isLoading}
                  />
                  {referenceImage ? (
                      <div className="relative w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-500 rounded-md p-1">
                          <img src={referenceImage.url} alt="Reference" className="w-full h-full object-cover rounded"/>
                          <button
                              onClick={() => setReferenceImage(null)}
                              className="absolute top-0 right-0 -mt-2 -mr-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-600"
                              aria-label="Remove reference image"
                              disabled={isLoading}
                          >
                              X
                          </button>
                      </div>
                  ) : (
                      <button
                          onClick={triggerFileSelect}
                          disabled={isLoading}
                          className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-500 rounded-md text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                          Click to upload an image
                      </button>
                  )}
              </div>

              <label htmlFor="aspectRatio" className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mt-4 mb-2 transition-colors ${referenceImage ? 'text-gray-400 dark:text-gray-500' : ''}`}>
                Aspect Ratio {referenceImage && <span className="font-normal">(ignored with reference image)</span>}
              </label>
              <select
                id="aspectRatio"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 disabled:bg-gray-200 dark:disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as ImageGenerationConfig['aspectRatio'])}
                disabled={isLoading || !!referenceImage}
              >
                <option value="1:1">1:1 (Square)</option>
                <option value="3:4">3:4 (Portrait)</option>
                <option value="4:3">4:3 (Landscape)</option>
                <option value="9:16">9:16 (Tall Portrait)</option>
                <option value="16:9">16:9 (Widescreen Landscape)</option>
              </select>
              
              <label htmlFor="imageStyle" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-4 mb-2">
                Image Style
              </label>
              <select
                id="imageStyle"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                value={imageStyle}
                onChange={(e) => setImageStyle(e.target.value)}
                disabled={isLoading}
              >
                <option value="default">Default</option>
                <option value="photorealistic">Photorealistic</option>
                <option value="cartoon">Cartoon</option>
                <option value="abstract">Abstract</option>
                <option value="impressionistic">Impressionistic</option>
                <option value="minimalist">Minimalist</option>
                <option value="cyberpunk">Cyberpunk</option>
              </select>

              {error && (
                <div className="mt-4 flex items-start p-3 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700/50 text-red-800 dark:text-red-300 rounded-md" role="alert">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 flex-shrink-0 text-red-500 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-bold">Image Generation Failed</p>
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => handleGenerateImage()}
            disabled={isLoading || !prompt.trim()}
            className="mt-6 w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-semibold rounded-md shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating Image...' : 'Generate Image'}
          </button>
        </div>

        {/* Image Display Section */}
        <div className="md:w-1/2 p-4 md:p-6 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Generated Image</h2>
          <div className="w-full max-w-md h-auto bg-gray-200 dark:bg-gray-800 flex items-center justify-center rounded-lg overflow-hidden shadow-inner p-2 min-h-[250px] sm:min-h-[350px] md:min-h-[400px]">
            {generatedImageUrl ? (
              <img src={generatedImageUrl} alt="Generated by Gemini" className="max-w-full max-h-full object-contain rounded-md"/>
            ) : (
              <div className="text-center text-gray-400 dark:text-gray-500 p-4">Your generated image will appear here.</div>
            )}
          </div>
          {generatedImageUrl && !isLoading && (
            <button
              onClick={handleDownloadImage}
              className="mt-4 py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md shadow-lg"
              aria-label="Download generated image"
            >
              Download Image
            </button>
          )}
        </div>
      </div>
      
      {/* History Section - Updated to Instagram-style grid */}
      {history.length > 0 && (
        <div className="w-full p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3">History</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {history.map((item, index) => (
              <div key={index} className="group relative aspect-square rounded-lg shadow-md overflow-hidden cursor-pointer">
                {item.referenceImageUrl && (
                  <img src={item.referenceImageUrl} alt="Ref" className="absolute top-1 left-1 w-8 h-8 rounded-full border-2 border-white object-cover z-10" title="Reference Image Used"/>
                )}
                <img
                  src={item.imageUrl}
                  alt={item.prompt}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-70 transition-all duration-300 flex flex-col items-center justify-center text-center p-2">
                  <p className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity mb-2 overflow-hidden overflow-ellipsis" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {item.prompt}
                  </p>
                  <div className="flex flex-wrap justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleViewHistoryImage(item)} className="text-xs bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded">View</button>
                    <button onClick={async () => {
                       await handleViewHistoryImage(item);
                       const refImg = item.referenceImageUrl ? { 
                         url: item.referenceImageUrl, 
                         data: item.referenceImageUrl.split(',')[1],
                         mimeType: item.referenceImageUrl.split(',')[0].split(':')[1].split(';')[0]
                       } : undefined;
                       handleGenerateImage({ p: item.prompt, ar: item.aspectRatio, is: item.imageStyle, refImgUrl: refImg?.url });
                    }} className="text-xs bg-purple-500 hover:bg-purple-600 text-white py-1 px-2 rounded">Regen</button>
                    <button onClick={() => handleDeleteHistoryItem(index)} className="text-xs bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGenerator;
