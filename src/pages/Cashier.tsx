import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ScanBarcode, Trash2, Plus, Minus, CreditCard, X, CheckCircle2, ChevronLeft, Package, ScanLine, AlertCircle, Edit3, Flashlight, FlashlightOff, Keyboard, Search, Calculator, Carrot, ChefHat, Coffee, Ticket, ShoppingBag } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { useData, Product, Order } from '../components/DataProvider';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

interface CartItem extends Product {
    qty: number;
}

const Cashier: React.FC = () => {
    const navigate = useNavigate();
    const { products, addOrder } = useData(); // Use global data

    const [activeModal, setActiveModal] = useState<null | 'scan' | 'payment' | 'clear' | 'editPrice' | 'manualInput'>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
    const [isPaid, setIsPaid] = useState(false);
    const [editingItem, setEditingItem] = useState<CartItem | null>(null);
    const [tempPrice, setTempPrice] = useState('');
    const [scanResult, setScanResult] = useState<string>('');
    const [isScanning, setIsScanning] = useState(false);
    const lastScanRef = useRef<string>('');
    const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [torchOn, setTorchOn] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [customPrice, setCustomPrice] = useState('');
    const [customName, setCustomName] = useState('');

    const [cart, setCart] = useState<CartItem[]>([]);

    // Camera + Barcode Scanner Logic
    useEffect(() => {
        let stream: MediaStream | null = null;

        if (activeModal === 'scan') {
            // Initialize barcode reader with hints for better accuracy
            const codeReader = new BrowserMultiFormatReader();
            codeReaderRef.current = codeReader;
            setIsScanning(false);
            lastScanRef.current = '';

            navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            })
                .then(s => {
                    stream = s;
                    streamRef.current = s;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;

                        // Start barcode scanning
                        codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, error) => {
                            if (result && !isScanning) {
                                const barcode = result.getText();
                                // Prevent duplicate scans within 2 seconds
                                if (barcode !== lastScanRef.current) {
                                    handleBarcodeDetected(barcode);
                                }
                            }
                            // Ignore NotFoundException (no barcode in frame)
                            if (error && !(error instanceof NotFoundException)) {
                                console.error('Barcode scan error:', error);
                            }
                        });
                    }
                })
                .catch(err => console.error("Camera permission denied", err));
        }

        return () => {
            // Cleanup
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (codeReaderRef.current) {
                codeReaderRef.current.reset();
            }
            if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current);
            }
            streamRef.current = null;
            setScanResult('');
            setIsScanning(false);
            lastScanRef.current = '';
        };
    }, [activeModal]);

    // Barcode Detection Handler
    const handleBarcodeDetected = (barcode: string) => {
        setScanResult(barcode);

        // Find product by barcode
        const product = products.find(p => p.barcode === barcode || p.sku === barcode);

        if (product) {
            addToCart(product);

            // Success feedback
            if (navigator.vibrate) navigator.vibrate(200);

            // Auto-close after 1 second
            setTimeout(() => {
                setActiveModal(null);
            }, 1000);
        } else {
            // Product not found
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            alert(`条形码 ${barcode} 未找到对应商品`);
        }
    };

    // Helper to add product to cart
    const addToCart = (product: Product) => {
        setCart(prev => {
            const existingItem = prev.find(p => p.id === product.id);
            if (existingItem) {
                return prev.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p);
            }
            return [...prev, { ...product, qty: 1 }];
        });
    };

    const handleAddCustomItem = () => {
        if (!customPrice) return;
        const price = parseFloat(customPrice);
        if (isNaN(price) || price <= 0) return;

        const newCustomItem: CartItem = {
            id: Date.now(),
            name: customName || '自定义商品',
            price: price,
            cost: 0, // No cost info for custom
            stock: 9999,
            alertThreshold: 0,
            sku: 'CUSTOM',
            tags: [],
            image: 'https://placehold.co/100x100/333333/ffffff?text=¥',
            category: 'custom',
            qty: 1
        };

        setCart(prev => [...prev, newCustomItem]);
        setCustomPrice('');
        setCustomName('');
        alert("已添加自定义商品");
    };

    const updateQty = (id: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(0, item.qty + delta);
                return { ...item, qty: newQty };
            }
            return item;
        }).filter(item => item.qty > 0));
    };

    const openPriceEdit = (item: CartItem) => {
        setEditingItem(item);
        setTempPrice(item.price.toString());
        setActiveModal('editPrice');
    };

    const confirmPriceEdit = () => {
        if (editingItem && tempPrice) {
            setCart(prev => prev.map(item =>
                item.id === editingItem.id ? { ...item, price: parseFloat(tempPrice) } : item
            ));
            setActiveModal(null);
            setEditingItem(null);
        }
    };

    const handlePaymentSuccess = () => {
        // Create the Order Object
        const newOrder: Order = {
            id: `#${Date.now().toString().slice(-6)}`,
            timestamp: Date.now(),
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            amount: totalAmount,
            itemsCount: totalCount,
            status: 'paid',
            paymentMethod: 'wechat', // Mock
            details: cart.map(item => ({
                id: item.id,
                name: item.name,
                qty: item.qty,
                price: item.price,
                cost: item.cost,
                sku: item.sku
            }))
        };

        // Save to Global Store
        addOrder(newOrder);

        // UI Feedback
        setIsPaid(true);
        setTimeout(() => {
            setActiveModal(null);
            setCart([]);
            setIsPaid(false);
        }, 2000);
    };

    const toggleTorch = () => {
        if (streamRef.current) {
            const track = streamRef.current.getVideoTracks()[0];
            if (track) {
                const newMode = !torchOn;
                track.applyConstraints({
                    advanced: [{ torch: newMode }]
                } as any).then(() => setTorchOn(newMode)).catch(() => setTorchOn(newMode));
            }
        }
    };

    // Filter Logic
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.includes(searchQuery);
            const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [searchQuery, selectedCategory, products]);

    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);

    const categories = [
        { id: 'all', label: '全部', icon: ShoppingBag },
        { id: 'drinks', label: '饮料', icon: Coffee },
        { id: 'snacks', label: '零食', icon: Ticket },
        { id: 'fresh', label: '生鲜', icon: Carrot },
        { id: 'homemade', label: '自制', icon: ChefHat },
        { id: 'tobacco', label: '烟酒', icon: Package },
        { id: 'custom', label: '无码', icon: Calculator },
    ];

    return (
        <div className="flex flex-col h-screen bg-zinc-100 dark:bg-zinc-950 transition-colors duration-300 relative">
            {/* Header */}
            <div className="px-4 py-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center shadow-sm z-10">
                <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-bold text-zinc-900 dark:text-white">收银台</h1>
                <ThemeToggle />
            </div>

            {/* Action Area */}
            <div className="p-4 z-10 grid grid-cols-2 gap-4">
                <button onClick={() => setActiveModal('scan')} className="bg-primary hover:bg-primary-hover active:scale-[0.98] transition-all h-24 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-lg shadow-primary/20 group relative overflow-hidden">
                    <div className="bg-white/20 p-2.5 rounded-full group-hover:scale-110 transition-transform"><ScanBarcode className="text-white" size={28} /></div>
                    <span className="text-white font-bold text-base tracking-wide">扫码录入</span>
                </button>
                <button onClick={() => setActiveModal('manualInput')} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 active:scale-[0.98] transition-all h-24 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-sm dark:shadow-lg dark:shadow-zinc-900/10 group relative overflow-hidden">
                    <div className="bg-zinc-100 dark:bg-zinc-700 p-2.5 rounded-full group-hover:scale-110 transition-transform text-zinc-600 dark:text-white border border-zinc-200 dark:border-zinc-600"><Search size={28} /></div>
                    <span className="text-zinc-900 dark:text-white font-bold text-base tracking-wide">搜索 / 手输</span>
                </button>
            </div>

            {/* Cart List */}
            <div className="flex-1 overflow-y-auto px-4 pb-32">
                <div className="flex justify-between items-center mb-2 px-2 text-zinc-500 text-sm">
                    <span>当前清单</span>
                    <span>{totalCount} 件商品</span>
                </div>
                {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-zinc-400">
                        <ShoppingBag size={48} className="mb-3 opacity-20" />
                        <p className="text-sm">购物车空空如也</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {cart.map((item) => (
                            <div key={item.id} className="bg-white dark:bg-zinc-900 p-3 rounded-2xl flex gap-3 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                <div className="w-20 h-20 rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                                    {item.sku === 'CUSTOM' ? <Calculator className="text-zinc-400" /> : <img src={item.image} alt={item.name} className="w-full h-full object-cover" />}
                                </div>
                                <div className="flex-1 flex flex-col justify-between py-0.5">
                                    <div><h3 className="text-zinc-900 dark:text-white font-bold text-base leading-tight mb-1">{item.name}</h3><div className="text-zinc-500 text-xs">SKU: {item.sku}</div></div>
                                    <div className="flex justify-between items-end">
                                        <button onClick={() => openPriceEdit(item)} className="text-primary font-bold flex items-center gap-1 active:opacity-60">¥ {item.price.toFixed(2)}<Edit3 size={12} className="opacity-50" /></button>
                                        <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                                            <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 flex items-center justify-center bg-white dark:bg-zinc-700 rounded-md shadow-sm border border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300"><Minus size={14} /></button>
                                            <span className="text-zinc-900 dark:text-white font-bold w-4 text-center">{item.qty}</span>
                                            <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 flex items-center justify-center bg-white dark:bg-zinc-700 rounded-md shadow-sm border border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300"><Plus size={14} /></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-[60] pb-safe">
                <div className="w-full flex justify-center py-2"><div className="w-12 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full"></div></div>
                <div className="px-6 pb-6 pt-1">
                    <div className="flex justify-between items-center mb-4"><span className="text-zinc-500 font-medium">合计金额</span><span className="text-3xl font-black text-zinc-900 dark:text-white"><span className="text-lg align-top mr-1">¥</span>{totalAmount.toFixed(2)}</span></div>
                    <div className="grid grid-cols-4 gap-3">
                        <button onClick={() => setActiveModal('clear')} disabled={cart.length === 0} className="col-span-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-bold hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"><Trash2 size={24} /></button>
                        <button onClick={() => { if (cart.length > 0) { setIsPaid(false); setActiveModal('payment'); } }} disabled={cart.length === 0} className="col-span-3 bg-primary hover:bg-primary-hover active:scale-[0.98] transition-all h-14 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-900/20 text-white disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:shadow-none"><span className="text-lg font-bold">立即结账</span><CreditCard size={20} /></button>
                    </div>
                </div>
            </div>

            {/* MODALS */}
            {/* Scan Modal */}
            {activeModal === 'scan' && (
                <div className="fixed inset-0 z-50 bg-black animate-in fade-in duration-300">
                    <div className="absolute inset-0 overflow-hidden"><video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-80" /></div>
                    <div className="absolute inset-0 flex flex-col">
                        <div className="p-6 flex justify-between items-center z-10">
                            <button onClick={() => setActiveModal(null)} className="p-2 rounded-full bg-black/40 text-white backdrop-blur-md"><ChevronLeft size={24} /></button>
                            <span className="text-white font-medium drop-shadow-md">扫描条形码/二维码</span>
                            <button onClick={toggleTorch} className={`p-2 rounded-full backdrop-blur-md ${torchOn ? 'bg-yellow-400 text-black' : 'bg-black/40 text-white'}`}>{torchOn ? <FlashlightOff size={24} /> : <Flashlight size={24} />}</button>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-10">
                            <div className="w-64 h-64 border-2 border-primary/80 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"><div className="absolute top-0 left-0 w-full h-1 bg-primary shadow-[0_0_10px_#FF3B30] animate-[scan_2s_ease-in-out_infinite]"></div></div>
                        </div>
                    </div>
                </div>
            )}

            {/* 1. Clear Cart */}
            {activeModal === 'clear' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-2xl z-10 w-full max-w-xs scale-100 animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4 mx-auto"><Trash2 size={24} /></div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2 text-center">清空购物车?</h3>
                        <div className="flex gap-3 mt-6"><button onClick={() => setActiveModal(null)} className="flex-1 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold text-sm">取消</button><button onClick={() => { setCart([]); setActiveModal(null); }} className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-hover text-sm shadow-lg shadow-primary/20">确认清空</button></div>
                    </div>
                </div>
            )}

            {/* 2. Manual Input / Search */}
            {activeModal === 'manualInput' && (
                <div className="fixed inset-0 z-[60] flex flex-col bg-zinc-100 dark:bg-zinc-950 animate-in slide-in-from-bottom duration-300">
                    <div className="px-4 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center shrink-0 shadow-sm z-20">
                        <button onClick={() => setActiveModal(null)} className="flex items-center text-zinc-500 dark:text-zinc-400 active:opacity-50"><ChevronLeft size={24} /> <span className="ml-1 text-sm font-bold">返回</span></button>
                        <div className="flex-1 px-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} /><input type="text" placeholder="搜索商品名称或拼音..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full py-2 pl-9 pr-4 text-sm text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-primary transition-all" /></div></div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 py-2 px-4 flex gap-2 overflow-x-auto no-scrollbar shrink-0 z-10">
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors ${selectedCategory === cat.id ? 'bg-primary text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                                <cat.icon size={12} /> {cat.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 pb-12 bg-zinc-50 dark:bg-zinc-950/50">
                        {selectedCategory === 'custom' ? (
                            <div className="max-w-xs mx-auto mt-10">
                                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 text-center">
                                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4"><Calculator size={32} /></div>
                                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">无码商品 / 自定义金额</h3>
                                    <div className="space-y-4">
                                        <div className="relative"><div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">¥</div><input type="number" placeholder="0.00" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl py-4 pl-10 pr-4 text-2xl font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-primary text-center" /></div>
                                        <input type="text" placeholder="商品名称 (选填)" value={customName} onChange={(e) => setCustomName(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl py-3 px-4 text-sm text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-primary text-center" />
                                        <button onClick={handleAddCustomItem} className="w-full py-4 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-transform flex items-center justify-center gap-2"><Plus size={20} /> 添加至购物车</button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {filteredProducts.map(product => (
                                    <div key={product.id} className="bg-white dark:bg-zinc-900 p-3 rounded-2xl flex flex-col shadow-sm border border-zinc-200 dark:border-zinc-800 relative overflow-hidden active:scale-[0.98] transition-transform">
                                        <div className="flex gap-3">
                                            <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-xl shrink-0 overflow-hidden flex items-center justify-center"><img src={product.image} alt={product.name} className="w-full h-full object-cover" /></div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center"><h3 className="font-bold text-zinc-900 dark:text-white truncate text-sm">{product.name}</h3><div className="text-primary font-bold mt-1 text-sm">¥{product.price.toFixed(2)}</div></div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                                            <span className="text-[10px] text-zinc-400 font-mono">{product.sku}</span>
                                            <button onClick={() => addToCart(product)} className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold text-xs flex items-center gap-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"><Plus size={12} /> 添加</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 5. Payment Modal */}
            {activeModal === 'payment' && (
                <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
                    <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 sm:zoom-in-95">
                        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">扫码支付</h2><button onClick={() => setActiveModal(null)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500"><X size={20} /></button>
                        </div>
                        <div className="p-8 flex flex-col items-center gap-6">
                            {!isPaid ? (
                                <>
                                    <div className="text-center"><div className="text-zinc-500 text-sm mb-1">应付金额</div><div className="text-4xl font-black text-zinc-900 dark:text-white"><span className="text-2xl mr-1">¥</span>{totalAmount.toFixed(2)}</div></div>
                                    <div className="w-64 h-64 bg-white p-2 rounded-2xl border-2 border-green-500 shadow-xl relative">
                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=wxp://${totalAmount.toFixed(2)}`} alt="Payment QR" className="w-full h-full object-contain" />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="bg-white p-1 rounded-lg shadow-sm"><div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center text-white font-bold text-xs">支</div></div></div>
                                    </div>
                                    <div className="text-zinc-500 text-xs flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>等待顾客扫码...</div>
                                    <button onClick={handlePaymentSuccess} className="w-full py-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">模拟支付成功</button>
                                </>
                            ) : (
                                <div className="py-12 flex flex-col items-center animate-in zoom-in duration-300">
                                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-500/30 mb-6"><CheckCircle2 size={40} /></div>
                                    <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">支付成功</h3><p className="text-zinc-500">正在打印小票...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Cashier;