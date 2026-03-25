/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { Upload, Download, Trash2, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2, Sparkles, Copy, ExternalLink, Tag, FileText, Type as TypeIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import * as piexif from 'piexifjs';
import confetti from 'canvas-confetti';

interface ProcessedFile {
  id: string;
  originalName: string;
  newName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  blob?: Blob;
}

const ORANGE = '#FF8C00';
const RED = '#FF4444';

export default function App() {
  return <OptimizerUI />;
}

function OptimizerUI() {
  const [fileEntries, setFileEntries] = useState<{ id: string; file: File; status: string }[]>([]);
  const [baseName, setBaseName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'images' | 'etsy'>('images');

  const keywordList = keywords.split('\n').map(k => k.trim()).filter(k => k);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Simple visual feedback could be added here
  };

  const generateEtsyContent = (keyword: string, baseName: string) => {
    const k = keyword.trim();
    const bn = baseName.trim();
    const capitalizedK = k.charAt(0).toUpperCase() + k.slice(1);
    const capitalizedBN = bn.charAt(0).toUpperCase() + bn.slice(1);
    
    // 1. Titles following user patterns but integrating Base Name (Max 140 chars)
    const titles = [
      `${capitalizedK}: ${capitalizedBN} Personalized Women's Satchel, Anniversary Gift`.slice(0, 140),
      `Handmade ${k}, ${capitalizedBN} woman, Laptop backpack, Mini backpack purse, School backpack, City backpack, Leather bag women`.slice(0, 140),
      `${capitalizedK} ${bn}, student computer rucksack, women work knapsack, christmas gift for her, unisex college rucksack, girlfriend gift`.slice(0, 140),
      `Personalized ${capitalizedK} ${capitalizedBN}: Handmade Vintage Travel Rucksack`.slice(0, 140)
    ];
    
    // 2. Tags: Must include Base Name and be different from words in the title (Max 20 chars per tag)
    // Extract words from title to avoid duplication in tags
    const titleWords = titles.join(' ').toLowerCase().split(/[\s,:-]+/).filter(w => w.length > 3);
    
    const potentialTags = [
      bn.toLowerCase(),
      "Handmade leather",
      "Personalized gift",
      "Anniversary gift",
      "Christmas gift",
      "Women's accessory",
      "Vintage style",
      "Travel rucksack",
      "Laptop bag",
      "School backpack",
      "Custom leather",
      "Gift for her",
      "Artisan made",
      "Unique design",
      "Premium quality",
      "Leather craft"
    ];

    const tags = potentialTags
      .filter(tag => !titleWords.includes(tag.toLowerCase()) || tag.toLowerCase() === bn.toLowerCase())
      .map(tag => tag.slice(0, 20))
      .slice(0, 13);

    // 3. Description with ~2.5% density of Base Name
    // We'll repeat the base name about 4-5 times in a ~180 word description
    const description = `✨ EXCLUSIVE HANDMADE ${k.toUpperCase()} ✨\n\nElevate your everyday carry with our premium ${bn}. Meticulously handcrafted from the finest materials, this piece combines timeless vintage aesthetics with modern functionality. Our ${bn} is designed for those who appreciate quality and durability.\n\n📐 SPECIFICATIONS:\n- Fits most standard laptops (13-16 inch)\n- Multiple compartments for organization\n- Adjustable straps for maximum comfort\n- Durable, high-quality finish on every ${bn}\n\n🎁 PERFECT FOR EVERY OCCASION:\nWhether it's an Anniversary Gift, a Christmas surprise for her, or a treat for yourself, this ${k} is designed to impress. This ${bn} is a gift that lasts for years and matures beautifully over time.\n\n🛠️ PERSONALIZATION:\nMake it truly yours! We offer custom engraving options to add that special personal touch to your item.\n\n📦 SHIPPING:\nFast and secure shipping worldwide. Each item is carefully packed to ensure it reaches you in perfect condition.\n\nThank you for supporting handmade craftsmanship and choosing our ${bn}! ❤️`;

    return { titles, tags, description };
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files) as File[];
    addFiles(droppedFiles);
  }, []);

  const addFiles = (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    const newEntries = validFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'pending'
    }));
    setFileEntries(prev => [...prev, ...newEntries]);
  };

  const processAll = async () => {
    if (fileEntries.length === 0 || !baseName) return;
    setIsProcessing(true);
    setProgress(0);

    const zip = new JSZip();
    const keywordList = keywords.split('\n').map(k => k.trim().replace(/\s+/g, '-')).filter(k => k);
    const keywordsStr = keywordList.join(', ');
    const cleanBase = baseName.trim().replace(/\s+/g, '-');

    try {
      for (let i = 0; i < fileEntries.length; i++) {
        const entry = fileEntries[i];
        const file = entry.file;
        
        // 1. Convert to JPG using Canvas
        const blob = await convertToJpg(file);
        
        // 2. Add Metadata using piexif
        const processedBlob = await injectMetadata(blob, keywordsStr);
        
        // 3. Rename
        const ext = '.jpg';
        // Pick 3 random keywords from the list for each image to cover more keywords
        const shuffled = [...keywordList].sort(() => 0.5 - Math.random());
        const selectedKeywords = shuffled.slice(0, 3).join('-');
        const namePrefix = selectedKeywords ? `${cleanBase}-${selectedKeywords}` : cleanBase;
        const newName = i === 0 ? `${namePrefix}${ext}` : `${namePrefix}-${i + 1}${ext}`;
        
        zip.file(newName, processedBlob);
        setProgress(Math.round(((i + 1) / fileEntries.length) * 100));
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}_optimized.zip`;
      link.click();
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF8C00', '#FFFFFF', '#FF4444']
      });
    } catch (err) {
      console.error(err);
      alert('Error processing images. Check console for details.');
    } finally {
      setIsProcessing(false);
    }
  };

  const convertToJpg = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('Canvas context failed');
          
          // Fill white background (for transparent PNGs)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject('Blob conversion failed');
          }, 'image/jpeg', 0.95);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const injectMetadata = async (blob: Blob, keywords: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const dataUrl = e.target?.result as string;
          
          // piexifjs works with data URLs
          const exifObj = {
            "0th": {
              [piexif.ImageIFD.ImageDescription]: keywords,
              [piexif.ImageIFD.Software]: "Team Crazy SEO Rank Optimizer",
            },
            "Exif": {
              [piexif.ExifIFD.UserComment]: piexif.helper.encode(keywords),
            }
          };

          const exifBytes = piexif.dump(exifObj);
          const newJpegData = piexif.insert(exifBytes, dataUrl);
          
          // Convert back to blob
          const byteString = atob(newJpegData.split(',')[1]);
          const mimeString = newJpegData.split(',')[0].split(':')[1].split(';')[0];
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          resolve(new Blob([ab], { type: mimeString }));
        } catch (err) {
          console.warn("Metadata injection failed, returning original blob", err);
          resolve(blob);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30">
      {/* Animated Banner */}
      <div className="relative overflow-hidden bg-gradient-to-b from-orange-600/20 to-transparent py-12 border-b border-white/10">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,140,0,0.1),transparent_70%)]" />
        </div>
        
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-widest mb-6"
          >
            <Sparkles size={14} />
            SEO Optimization Suite
          </motion.div>
          
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-orange-400 to-red-500">
            CRAZY SEO RANK
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto font-light">
            Bulk rename, metadata injection, and format conversion. 
            Built for speed, optimized for search engines.
          </p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Controls */}
        <div className="lg:col-span-5 space-y-8">
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/10 mb-4">
            <button
              onClick={() => setActiveTab('images')}
              className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                activeTab === 'images' ? 'bg-orange-600 text-white' : 'text-white/40 hover:text-white/60'
              }`}
            >
              Image SEO
            </button>
            <button
              onClick={() => setActiveTab('etsy')}
              className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                activeTab === 'etsy' ? 'bg-orange-600 text-white' : 'text-white/40 hover:text-white/60'
              }`}
            >
              Etsy Listing
            </button>
          </div>

          {activeTab === 'images' ? (
            <>
              <section className="space-y-4">
                <label className="block text-xs font-bold uppercase tracking-widest text-white/40">
                  1. Main Keyword (Base Name)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Buy-leather-bags"
                  value={baseName}
                  onChange={(e) => setBaseName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500/50 transition-colors text-lg"
                />
              </section>

              <section className="space-y-4">
                <label className="block text-xs font-bold uppercase tracking-widest text-white/40">
                  2. Multilingual Keywords (One per line)
                </label>
                <textarea
                  placeholder="Enter keywords..."
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  rows={6}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500/50 transition-colors resize-none font-mono text-sm"
                />
              </section>

              <button
                onClick={processAll}
                disabled={isProcessing || fileEntries.length === 0 || !baseName}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                  isProcessing || fileEntries.length === 0 || !baseName
                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                    : 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/20 active:scale-[0.98]'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Processing {progress}%
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    Optimize & Download ZIP
                  </>
                )}
              </button>
              
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-white/40 leading-relaxed">
                <p className="font-bold text-white/60 mb-1 uppercase tracking-tighter">Optimization Logic:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Convert all images to high-quality JPEG</li>
                  <li>Randomized SEO Renaming: <code className="text-orange-400">Main-Keyword-R1-R2-R3.jpg</code></li>
                  <li>Inject keywords into EXIF ImageDescription & UserComment</li>
                  <li>Strip original metadata for clean SEO footprint</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <section className="space-y-4">
                <label className="block text-xs font-bold uppercase tracking-widest text-white/40">
                  Input Keywords (One per line)
                </label>
                <textarea
                  placeholder="Enter keywords to generate Etsy listings..."
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  rows={10}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500/50 transition-colors resize-none font-mono text-sm"
                />
              </section>
              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 text-xs text-orange-400/80 leading-relaxed">
                <p className="font-bold mb-1 uppercase tracking-tighter flex items-center gap-2">
                  <Sparkles size={12} /> Etsy Pattern Engine:
                </p>
                <p>Generating high-ranking titles, 13 optimized tags, and professional descriptions for each keyword entered.</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Content Display */}
        <div className="lg:col-span-7 space-y-6">
          {activeTab === 'images' ? (
            <>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="relative group"
              >
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="border-2 border-dashed border-white/10 group-hover:border-orange-500/50 rounded-2xl p-12 transition-all bg-white/[0.02] flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
                    <Upload size={32} />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-medium">Drop images here or click to browse</p>
                    <p className="text-white/40 text-sm mt-1">Supports JPG, PNG, WEBP, etc.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {fileEntries.map((entry) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/10 group"
                    >
                      <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-white/20 overflow-hidden">
                        <FilePreview file={entry.file} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{entry.file.name}</p>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest">
                          {(entry.file.size / 1024).toFixed(1)} KB • {entry.file.type.split('/')[1]}
                        </p>
                      </div>
                      <button
                        onClick={() => setFileEntries(prev => prev.filter(f => f.id !== entry.id))}
                        className="p-2 text-white/20 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {fileEntries.length === 0 && (
                  <div className="text-center py-12 text-white/20 italic">
                    No files selected yet.
                  </div>
                )}
              </div>

              {fileEntries.length > 0 && (
                <button
                  onClick={() => setFileEntries([])}
                  className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  Clear All Files
                </button>
              )}
            </>
          ) : (
            <div className="space-y-8 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
              {keywordList.length > 0 ? (
                keywordList.map((keyword, idx) => {
                  const content = generateEtsyContent(keyword, baseName);
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6"
                    >
                      <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <h3 className="text-orange-400 font-bold flex items-center gap-2">
                          <ExternalLink size={16} /> {keyword}
                        </h3>
                        <span className="text-[10px] bg-white/10 px-2 py-1 rounded uppercase tracking-widest text-white/60">
                          Listing #{idx + 1}
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 flex items-center gap-2">
                            <TypeIcon size={12} /> Optimized Titles
                          </p>
                          <div className="grid gap-2">
                            {content.titles.map((title, tIdx) => (
                              <div key={tIdx} className="group relative">
                                <div className="p-3 bg-white/5 rounded-lg text-sm border border-white/5 group-hover:border-orange-500/30 transition-colors pr-10">
                                  {title}
                                </div>
                                <button
                                  onClick={() => copyToClipboard(title)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/20 hover:text-orange-400 transition-colors"
                                  title="Copy Title"
                                >
                                  <Copy size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 flex items-center gap-2">
                            <Tag size={12} /> 13 SEO Tags
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {content.tags.map((tag, tagIdx) => (
                              <span key={tagIdx} className="px-2 py-1 bg-white/5 rounded text-[10px] border border-white/5 text-white/60">
                                {tag}
                              </span>
                            ))}
                            <button
                              onClick={() => copyToClipboard(content.tags.join(', '))}
                              className="ml-auto p-1 text-orange-400 hover:scale-110 transition-transform"
                              title="Copy All Tags"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 flex items-center gap-2">
                            <FileText size={12} /> Description Template
                          </p>
                          <div className="relative group">
                            <pre className="p-4 bg-white/5 rounded-lg text-xs border border-white/5 whitespace-pre-wrap font-sans text-white/60 leading-relaxed">
                              {content.description}
                            </pre>
                            <button
                              onClick={() => copyToClipboard(content.description)}
                              className="absolute right-2 top-2 p-2 text-white/20 hover:text-orange-400 transition-colors"
                              title="Copy Description"
                            >
                              <Copy size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-24 text-white/20 italic">
                  Enter keywords on the left to generate Etsy listings.
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center font-black text-xs italic">
            CSR
          </div>
          <div>
            <p className="font-bold text-sm tracking-tight">Team Crazy SEO Rank</p>
            <p className="text-xs text-white/40">Professional Image Optimization Tool</p>
          </div>
        </div>
        <div className="flex gap-8 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
          <span>Privacy First</span>
          <span>Client-Side Processing</span>
          <span>SEO Optimized</span>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 140, 0, 0.3);
        }
      `}</style>
    </div>
  );
}

function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return <ImageIcon size={20} />;
  return <img src={url} alt="preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />;
}
