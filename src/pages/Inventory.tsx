import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Package, Search, Plus, X, AlertTriangle, CheckCircle2, MoreVertical, ScanBarcode, Sparkles, Calculator, Camera, ChevronLeft, Tag, ImagePlus, Edit3, Coins, ChefHat, Carrot, BellRing, Trash2, Eye, Truck, ArrowDown, ScanLine, BoxSelect } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { useData, Product } from '../components/DataProvider';

const Inventory: React.FC = () => {
    const { products, addProduct, updateProduct, deleteProduct, restockProduct } = useData();

    // State
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Modal State
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

    // Restock Modal State
    const [restockItem, setRestockItem] = useState<Product | null>(null);
    const [restockForm, setRestockForm] = useState({ qty: '', cost: '' });

    // Menu State
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);

    // Quick Price Edit State
    const [editingPriceProduct, setEditingPriceProduct] = useState<Product | null>(null);
    const [tempPrice, setTempPrice] = useState('');

    // Scanning State
    const [scanMode, setScanMode] = useState<null | 'sku' | 'ai_identify' | 'restock_scan'>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Product Form State
    const initialFormState = {
        name: '',
        sku: '',
        price: '',
        cost: '',
        stock: '',
        alertThreshold: '5',
        category: 'other' as Product['category'],
        currentTag: '',
        tags: [] as string[],
        image: '',
        productionDate: '',
        shelfLifeDays: ''
    };
    const [productForm, setProductForm] = useState(initialFormState);

    // Helper function: Calculate expiration info
    const calculateExpirationInfo = (product: { productionDate?: string, shelfLifeDays?: number }) => {
        if (!product.productionDate || !product.shelfLifeDays) return null;

        const prodDate = new Date(product.productionDate);
        const expDate = new Date(prodDate);
        expDate.setDate(expDate.getDate() + product.shelfLifeDays);

        const today = new Date();
        const daysRemaining = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        return {
            expirationDate: expDate,
            daysRemaining,
            isExpired: daysRemaining < 0,
            isExpiringSoon: daysRemaining >= 0 && daysRemaining <= 30,
            isNearExpiry: daysRemaining > 30 && daysRemaining <= 60,
        };
    };

    // Calculate unique existing tags from all products
    const existingTags = useMemo(() => {
        const tags = new Set<string>();
        products.forEach(p => p.tags.forEach(t => tags.add(t)));
        return Array.from(tags);
    }, [products]);

    // Camera Logic
    useEffect(() => {
        let stream: MediaStream | null = null;
        if (scanMode) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                .then(s => {
                    stream = s;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                })
                .catch(err => console.log("Camera permission denied", err));
        }
        return () => {
            if (stream) stream.getTracks().forEach(track => track.stop());
        };
    }, [scanMode]);

    // Simulate Scan Result
    const handleSimulateScan = () => {
        if (scanMode === 'sku') {
            // Just filling SKU for new product
            setProductForm(prev => ({ ...prev, sku: `69${Math.floor(Math.random() * 1000000000)}` }));
        } else if (scanMode === 'ai_identify') {
            // AI Identify simulation
            setProductForm(prev => ({
                ...prev,
                name: 'AI识别: 青菜',
                sku: 'FRESH-AUTO-01',
                price: '3.50',
                cost: '1.20',
                category: 'fresh',
                tags: ['蔬菜', '时令'],
                image: 'https://placehold.co/100x100?text=Veg'
            }));
        } else if (scanMode === 'restock_scan') {
            // SMART SCAN LOGIC: Check if product exists
            // 1. Simulate scanning a barcode
            const simulatedBarcode = Math.random() > 0.3
                ? products[Math.floor(Math.random() * products.length)]?.sku // 70% chance to scan existing
                : `NEW-${Math.floor(Math.random() * 10000)}`; // 30% chance to scan new

            const existingProduct = products.find(p => p.sku === simulatedBarcode);

            if (existingProduct) {
                // Case A: Product exists -> Open Restock Modal
                handleOpenRestock(existingProduct);
            } else {
                // Case B: Product does not exist -> Redirect to Add New
                // Use a small timeout to allow modal transition
                alert(`未找到商品 (SKU: ${simulatedBarcode})，请先录入档案`);
                setProductForm(initialFormState);
                setProductForm(prev => ({ ...prev, sku: simulatedBarcode }));
                setIsProductModalOpen(true);
            }
        }
        setScanMode(null);
    };

    // Image Upload Handler
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProductForm(prev => ({ ...prev, image: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const removeImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setProductForm(prev => ({ ...prev, image: '' }));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Profit Calculations
    const sellingPrice = parseFloat(productForm.price) || 0;
    const costPrice = parseFloat(productForm.cost) || 0;
    const profit = sellingPrice - costPrice;
    const margin = sellingPrice > 0 ? ((profit / sellingPrice) * 100).toFixed(1) : '0';

    // Filtering Logic
    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.sku.includes(searchQuery);
        if (!matchesSearch) return false;

        if (activeCategory === 'all') return true;
        if (activeCategory === 'low_stock') return product.stock < product.alertThreshold;
        return product.category === activeCategory;
    });

    // Form Handlers
    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && productForm.currentTag.trim()) {
            e.preventDefault();
            addTag(productForm.currentTag.trim());
        }
    };

    const addTag = (tag: string) => {
        if (!productForm.tags.includes(tag)) {
            setProductForm(prev => ({
                ...prev,
                tags: [...prev.tags, tag],
                currentTag: ''
            }));
        }
    }

    const removeTag = (tagToRemove: string) => {
        setProductForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }));
    };

    const handleOpenAddModal = () => {
        setProductForm(initialFormState);
        setEditingId(null);
        setIsProductModalOpen(true);
        setOpenMenuId(null);
    };

    const handleEditProduct = (product: Product) => {
        setProductForm({
            name: product.name,
            sku: product.sku,
            price: product.price.toString(),
            cost: product.cost.toString(),
            stock: product.stock.toString(),
            alertThreshold: product.alertThreshold.toString(),
            category: product.category,
            currentTag: '',
            tags: product.tags,
            image: product.image,
            productionDate: product.productionDate || '',
            shelfLifeDays: product.shelfLifeDays?.toString() || ''
        });
        setEditingId(product.id);
        setIsProductModalOpen(true);
        setOpenMenuId(null);
    };

    const handleDeleteClick = (id: number) => {
        setDeleteConfirmId(id);
        setOpenMenuId(null);
    };

    const confirmDelete = () => {
        if (deleteConfirmId !== null) {
            deleteProduct(deleteConfirmId);
            setDeleteConfirmId(null);
        }
    };

    const handleSubmitProduct = () => {
        if (!productForm.name || !productForm.price) return;

        const productData: Product = {
            id: editingId || Date.now(),
            name: productForm.name,
            sku: productForm.sku || `SKU-${Date.now()}`,
            price: parseFloat(productForm.price),
            cost: parseFloat(productForm.cost) || 0,
            stock: parseInt(productForm.stock) || 0,
            alertThreshold: parseInt(productForm.alertThreshold) || 5,
            tags: productForm.tags,
            category: productForm.category,
            image: productForm.image || 'https://placehold.co/100x100?text=No+Img',
            barcode: productForm.sku || `SKU-${Date.now()}`,
            productionDate: productForm.productionDate || undefined,
            shelfLifeDays: productForm.shelfLifeDays ? parseInt(productForm.shelfLifeDays) : undefined
        };

        if (editingId) {
            updateProduct(productData);
        } else {
            addProduct(productData);
        }

        setIsProductModalOpen(false);
        setProductForm(initialFormState);
        setEditingId(null);
    };

    // Quick Price Edit Handler
    const openPriceEdit = (product: Product) => {
        setEditingPriceProduct(product);
        setTempPrice(product.price.toString());
    };

    const saveNewPrice = () => {
        if (editingPriceProduct && tempPrice) {
            updateProduct({ ...editingPriceProduct, price: parseFloat(tempPrice) });
            setEditingPriceProduct(null);
        }
    };

    // Restock Handlers
    const handleOpenRestock = (product: Product) => {
        setRestockItem(product);
        setRestockForm({ qty: '', cost: '' });
        setOpenMenuId(null);
    };

    const handleRestockSubmit = () => {
        if (restockItem && restockForm.qty && restockForm.cost) {
            const qty = parseInt(restockForm.qty);
            const cost = parseFloat(restockForm.cost);
            if (qty > 0 && cost >= 0) {
                restockProduct(restockItem.id, qty, cost);
                setRestockItem(null);
            }
        }
    };

    const categories = [
        { id: 'all', label: '全部' },
        { id: 'fresh', label: '生鲜果蔬', icon: Carrot, color: 'text-green-500' },
        { id: 'homemade', label: '自制面点', icon: ChefHat, color: 'text-orange-500' },
        { id: 'drinks', label: '饮料' },
        { id: 'snacks', label: '零食' },
        { id: 'tobacco', label: '烟酒' },
        { id: 'low_stock', label: '预警' },
    ];

    return (
        <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 pb-24 transition-colors duration-300 relative">
            {/* Click outside to close menus */}
            {openMenuId !== null && (
                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)}></div>
            )}

            {/* Header */}
            <header className="px-6 py-6 flex justify-between items-center sticky top-0 bg-zinc-100/95 dark:bg-zinc-950/95 backdrop-blur-md z-10 border-b border-zinc-200/50 dark:border-zinc-800/50">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">库存管理</h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">生鲜 / 自制 / 标品</p>
                </div>
                <ThemeToggle />
            </header>

            <div className="px-6 pt-4">
                {/* Prominent Action Buttons (ADDED) */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <button
                        onClick={() => setScanMode('restock_scan')}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-2 shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
                    >
                        <ScanLine size={28} />
                        <div className="text-center sm:text-left">
                            <div className="font-bold text-lg leading-none">扫码进货</div>
                            <div className="text-[10px] opacity-80 mt-1 font-medium">自动识别老品/新品</div>
                        </div>
                    </button>
                    <button
                        onClick={handleOpenAddModal}
                        className="bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-700 shadow-sm active:scale-95 transition-all"
                    >
                        <BoxSelect size={28} className="text-zinc-400 dark:text-zinc-500" />
                        <div className="text-center sm:text-left">
                            <div className="font-bold text-lg leading-none">手动录入</div>
                            <div className="text-[10px] text-zinc-400 mt-1 font-medium">无码商品/建档</div>
                        </div>
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative mb-6 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors" size={20} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索商品名称、拼音或SKU..."
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-zinc-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
                    />
                </div>

                {/* Category Filter */}
                <div className="flex gap-3 mb-6 overflow-x-auto no-scrollbar pb-2">
                    {categories.map(cat => {
                        const isActive = activeCategory === cat.id;
                        const Icon = cat.icon;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`px-4 py-2 rounded-full font-bold whitespace-nowrap text-sm transition-all flex items-center gap-2 ${isActive
                                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md transform scale-105'
                                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800'
                                    }`}
                            >
                                {Icon && <Icon size={14} className={isActive ? 'text-inherit' : cat.color} />}
                                {cat.label}
                            </button>
                        );
                    })}
                </div>

                {/* Product List */}
                <div className="space-y-4 pb-20">
                    {filteredProducts.map((product) => (
                        <div key={product.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl flex gap-4 border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-visible group">
                            {product.stock < product.alertThreshold && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-l-2xl"></div>
                            )}

                            <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden">
                                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                {(product.category === 'fresh' || product.category === 'homemade') && (
                                    <div className="absolute top-0 left-0 bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-br-lg">
                                        {product.category === 'fresh' ? '生鲜' : '自制'}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start relative">
                                    <div>
                                        <h3 className="font-bold text-zinc-900 dark:text-white text-base truncate pr-2">{product.name}</h3>
                                        <p className="text-zinc-400 text-[10px] font-mono mt-0.5">SKU: {product.sku}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* OBVIOUS RESTOCK BUTTON (ADDED) */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleOpenRestock(product); }}
                                            className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center gap-1 border border-blue-100 dark:border-blue-900/30"
                                        >
                                            <Truck size={16} />
                                            <span className="text-xs font-bold">进货</span>
                                        </button>

                                        <div className="relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === product.id ? null : product.id); }}
                                                className={`p-1.5 rounded-lg transition-colors ${openMenuId === product.id ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                            {openMenuId === product.id && (
                                                <div className="absolute right-0 top-8 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 z-30 w-36 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                    {/* Removed duplicate Restock button from menu since it's on the card now */}
                                                    <button onClick={(e) => { e.stopPropagation(); handleEditProduct(product); }} className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800/50"><Edit3 size={14} /> 编辑/查看</button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(product.id); }} className="w-full text-left px-4 py-3 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 flex items-center gap-2"><Trash2 size={14} /> 删除商品</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-1.5 flex-wrap mt-2 mb-2">
                                    {product.tags.map(tag => (
                                        <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-md border border-zinc-200 dark:border-zinc-700">#{tag}</span>
                                    ))}
                                </div>

                                <div className="flex justify-between items-end mt-1">
                                    <div className="flex flex-col">
                                        <button onClick={() => openPriceEdit(product)} className="text-primary font-bold text-lg leading-none flex items-center gap-1 active:opacity-60 transition-opacity text-left">
                                            <span><span className="text-xs mr-0.5">¥</span>{product.price.toFixed(2)}</span><Edit3 size={14} className="opacity-50" />
                                        </button>
                                        <span className="text-[10px] text-zinc-400 mt-1">
                                            {(product.category === 'fresh' || product.category === 'homemade') ? '价格波动频繁 · 点击修改' : `进价: ¥${product.cost.toFixed(2)} · 利润: ¥${(product.price - product.cost).toFixed(2)}`}
                                        </span>
                                    </div>
                                    <div className={`text-xs px-2 py-1 rounded-lg font-bold flex items-center gap-1 ${product.stock < product.alertThreshold ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                                        {product.stock < product.alertThreshold ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />} 库存: {product.stock}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredProducts.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                            <Package size={48} className="opacity-20 mb-4" /><p>暂无相关商品</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Plus Button (Optional now since we have top buttons, but kept for consistency) */}
            <button onClick={handleOpenAddModal} className="fixed bottom-24 left-1/2 -translate-x-1/2 w-14 h-14 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform z-30 opacity-80 hover:opacity-100">
                <Plus size={24} />
            </button>

            {/* Restock Modal */}
            {restockItem && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRestockItem(null)} />
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-xs p-6 rounded-3xl shadow-2xl z-10 border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center"><Truck size={24} /></div>
                            <div>
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">进货入库</h3>
                                <p className="text-zinc-500 text-xs truncate max-w-[150px]">{restockItem.name}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 mb-1.5 block">进货数量</label>
                                <input
                                    type="number"
                                    autoFocus
                                    placeholder="0"
                                    value={restockForm.qty}
                                    onChange={(e) => {
                                        const q = e.target.value;
                                        setRestockForm(prev => ({
                                            ...prev,
                                            qty: q,
                                            cost: q && restockItem ? (parseInt(q) * restockItem.cost).toFixed(2) : prev.cost
                                        }));
                                    }}
                                    className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl py-3 px-4 text-xl font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-zinc-500 mb-1.5 block">进货总成本 (¥)</label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={restockForm.cost}
                                    onChange={(e) => setRestockForm(prev => ({ ...prev, cost: e.target.value }))}
                                    className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl py-3 px-4 text-xl font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Preview Calculation */}
                            {restockForm.qty && (
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-xs">
                                    <span className="text-zinc-500">库存变化:</span>
                                    <div className="flex items-center gap-2 font-bold">
                                        <span className="text-zinc-400">{restockItem.stock}</span>
                                        <ArrowDown size={12} className="rotate-[-90deg] text-blue-500" />
                                        <span className="text-blue-500">{restockItem.stock + parseInt(restockForm.qty)}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setRestockItem(null)} className="flex-1 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold">取消</button>
                            <button onClick={handleRestockSubmit} className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/20">确认入库</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reused Modals (Quick Price Edit, Delete, Add/Edit) */}
            {editingPriceProduct && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingPriceProduct(null)} />
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-xs p-6 rounded-3xl shadow-2xl z-10 border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">快速改价</h3>
                        <p className="text-zinc-500 text-sm mb-4">{editingPriceProduct.name}</p>
                        <div className="relative mb-6">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">¥</div>
                            <input type="number" autoFocus value={tempPrice} onChange={(e) => setTempPrice(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl py-4 pl-10 pr-4 text-2xl font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        <div className="flex gap-3"><button onClick={() => setEditingPriceProduct(null)} className="flex-1 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold">取消</button><button onClick={saveNewPrice} className="flex-1 py-3 rounded-xl bg-primary text-white font-bold">保存</button></div>
                    </div>
                </div>
            )}

            {deleteConfirmId !== null && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)} />
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-2xl z-10 w-full max-w-xs scale-100 animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4 mx-auto"><Trash2 size={24} /></div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2 text-center">删除商品?</h3>
                        <div className="flex gap-3"><button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold text-sm">取消</button><button onClick={confirmDelete} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 text-sm shadow-lg shadow-red-500/20">确认删除</button></div>
                    </div>
                </div>
            )}

            {isProductModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsProductModalOpen(false)} />
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 overflow-hidden animate-in slide-in-from-bottom duration-300 sm:zoom-in-95 flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900">
                            <h2 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">{editingId ? <Edit3 size={20} className="text-primary" /> : <Package size={20} className="text-primary" />} {editingId ? '编辑商品详情' : '录入新商品'}</h2>
                            <button onClick={() => setIsProductModalOpen(false)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><X size={20} className="text-zinc-500" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-5">
                            {/* Image Upload */}
                            <div className="flex justify-center">
                                <div onClick={() => fileInputRef.current?.click()} className="w-28 h-28 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-2 border-dashed border-zinc-200 dark:border-zinc-700 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group hover:border-primary/50 transition-all">
                                    {productForm.image ? <><img src={productForm.image} alt="Preview" className="w-full h-full object-cover" /><button onClick={removeImage} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-red-500 transition-colors"><X size={12} /></button></> : <><div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform"><ImagePlus size={20} className="text-zinc-400" /></div><span className="text-xs text-zinc-400 font-medium group-hover:text-primary transition-colors">上传图片</span></>}
                                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                                </div>
                            </div>

                            {/* Basic Info */}
                            <div className="space-y-3">
                                <input type="text" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 outline-none focus:ring-1 focus:ring-primary text-zinc-900 dark:text-white font-bold" placeholder="商品名称" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} />
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                        <input type="text" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl py-3 pl-10 pr-3 outline-none focus:ring-1 focus:ring-primary text-zinc-900 dark:text-white text-sm font-mono" placeholder="条形码 / SKU" value={productForm.sku} onChange={e => setProductForm({ ...productForm, sku: e.target.value })} />
                                    </div>
                                    <button onClick={() => setScanMode('sku')} className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"><Camera size={20} /></button>
                                </div>
                            </div>

                            {/* Pricing Grid */}
                            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center gap-2 mb-3 text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase"><Coins size={12} /> 价格设置</div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold text-zinc-500 mb-1.5 block">进货价 (¥)</label><input type="number" className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 outline-none focus:ring-1 focus:ring-primary text-zinc-900 dark:text-white" value={productForm.cost} onChange={e => setProductForm({ ...productForm, cost: e.target.value })} /></div>
                                    <div><label className="text-xs font-bold text-zinc-500 mb-1.5 block">零售价 (¥)</label><input type="number" className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 outline-none focus:ring-1 focus:ring-primary text-zinc-900 dark:text-white font-bold text-lg text-right" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: e.target.value })} /></div>
                                </div>
                                <div className="flex justify-between mt-2 px-1">
                                    <span className="text-[10px] text-zinc-400">预估毛利: <span className="text-primary font-bold">¥{profit.toFixed(2)}</span></span>
                                    <span className="text-[10px] text-zinc-400">毛利率: <span className="text-primary font-bold">{margin}%</span></span>
                                </div>
                            </div>

                            {/* Stock & Alerts Section (Restored) */}
                            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center gap-2 mb-3 text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase"><Package size={12} /> 库存管理</div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-zinc-500 mb-1.5 block">当前库存</label>
                                        <div className="relative">
                                            <input type="number" className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 outline-none focus:ring-1 focus:ring-primary text-zinc-900 dark:text-white font-bold" value={productForm.stock} onChange={e => setProductForm({ ...productForm, stock: e.target.value })} />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">件</div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-zinc-500 mb-1.5 block">预警阈值</label>
                                        <div className="relative">
                                            <input type="number" className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 outline-none focus:ring-1 focus:ring-primary text-zinc-900 dark:text-white" value={productForm.alertThreshold} onChange={e => setProductForm({ ...productForm, alertThreshold: e.target.value })} />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">件</div>
                                        </div>
                                        <div className="text-[10px] text-zinc-400 mt-1">低于此数量将报警</div>
                                    </div>
                                </div>
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="text-xs font-bold text-zinc-500 mb-1.5 block">标签 (回车添加)</label>
                                <div className="flex flex-wrap gap-2 mb-2 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 min-h-[50px]">
                                    {productForm.tags.map(tag => (
                                        <span key={tag} className="px-2 py-1 bg-white dark:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 shadow-sm border border-zinc-100 dark:border-zinc-600">
                                            {tag} <button onClick={() => removeTag(tag)}><X size={10} /></button>
                                        </span>
                                    ))}
                                    <input type="text" className="bg-transparent outline-none text-sm min-w-[60px] flex-1 text-zinc-900 dark:text-white" placeholder="添加标签..." value={productForm.currentTag} onChange={e => setProductForm({ ...productForm, currentTag: e.target.value })} onKeyDown={handleAddTag} />
                                </div>
                                {existingTags.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-[10px] text-zinc-400 mb-1.5 px-1">快速选择已有标签:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {existingTags.filter(t => !productForm.tags.includes(t)).map(tag => (
                                                <button
                                                    key={tag}
                                                    onClick={() => addTag(tag)}
                                                    className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                                >
                                                    #{tag}
                                                </button>
                                            ))}
                                            {existingTags.filter(t => !productForm.tags.includes(t)).length === 0 && (
                                                <span className="text-[10px] text-zinc-400 px-1 italic">所有标签已添加</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                            <button onClick={handleSubmitProduct} className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform flex items-center justify-center gap-2">{editingId ? <CheckCircle2 size={20} /> : <Plus size={20} />} {editingId ? '保存修改' : '确认入库'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Scan Modal Overlay */}
            {(scanMode === 'sku' || scanMode === 'restock_scan') && (
                <div className="fixed inset-0 z-[80] bg-black animate-in fade-in duration-300">
                    <div className="absolute inset-0 overflow-hidden"><video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-80" /></div>
                    <div className="absolute inset-0 flex flex-col">
                        <div className="p-6 flex justify-between items-center z-10">
                            <button onClick={() => setScanMode(null)} className="p-2 rounded-full bg-black/40 text-white backdrop-blur-md"><ChevronLeft size={24} /></button>
                            <span className="text-white font-medium drop-shadow-md">
                                {scanMode === 'restock_scan' ? '扫码进货 / 自动识别' : '扫描商品条码'}
                            </span>
                            <div className="w-10"></div>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-10">
                            <div
                                onClick={handleSimulateScan}
                                className="w-64 h-64 border-2 border-primary/80 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] cursor-pointer"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-primary shadow-[0_0_10px_#FF3B30] animate-[scan_2s_ease-in-out_infinite]"></div>
                                <div className="absolute bottom-4 left-0 right-0 text-center text-white/50 text-xs">点击框内模拟扫码</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;