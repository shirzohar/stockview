import './App.css';
import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

function App() {
  const [showForm, setShowForm] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isAddingNewStock, setIsAddingNewStock] = useState(false);
  const [israeliStocks, setIsraeliStocks] = useState([]);
  const [americanStocks, setAmericanStocks] = useState([]);
  const [pensionFunds, setPensionFunds] = useState([]);
  const [bankBalances, setBankBalances] = useState([]);
  const [cashFunds, setCashFunds] = useState([]);
  const [formData, setFormData] = useState({
    itemType: 'stock',
    stockName: '',
    securityId: '',
    purchaseDate: '',
    purchasePrice: '',
    quantity: '',
    exchange: 'israeli',
    exchangeRate: ''
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingStock, setEditingStock] = useState(null);
  const [showAmericanColumns, setShowAmericanColumns] = useState(true);
  const [editingField, setEditingField] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});

  // טעינת נתונים מ-LocalStorage בעת טעינת הקומפוננטה
  useEffect(() => {
    const savedIsraeliStocks = localStorage.getItem('israeliStocks');
    const savedAmericanStocks = localStorage.getItem('americanStocks');
    const savedPensionFunds = localStorage.getItem('pensionFunds');
    const savedBankBalances = localStorage.getItem('bankBalances');
    const savedCashFunds = localStorage.getItem('cashFunds');
    
    if (savedIsraeliStocks) {
      setIsraeliStocks(JSON.parse(savedIsraeliStocks));
    }
    
    if (savedAmericanStocks) {
      setAmericanStocks(JSON.parse(savedAmericanStocks));
    }
    if (savedPensionFunds) {
      setPensionFunds(JSON.parse(savedPensionFunds));
    }
    if (savedBankBalances) {
      setBankBalances(JSON.parse(savedBankBalances));
    }
    if (savedCashFunds) {
      setCashFunds(JSON.parse(savedCashFunds));
    }
  }, []);

  // פונקציה לקבלת מחיר נוכחי ואחוז שינוי יומי מ-TASE (דרך השרת המקומי)
  const fetchIsraeliStockPrice = async (stockId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/israeli-stock/${stockId}`);
      if (!response.ok) throw new Error('שגיאה בקריאת נתונים מהשרת');
      const json = await response.json();
      return json;
    } catch (error) {
      return null;
    }
  };

  // עדכון אוטומטי של מחירי מניות כל 10 שניות
  useEffect(() => {
    const interval = setInterval(async () => {
      // לא מעדכן אם המשתמש נמצא במצב עריכה או מוסיף מנייה חדשה
      if (isEditMode || editingField || isAddingNewStock) {
        return;
      }
      
      // עדכון מניות ישראליות
      if (israeliStocks.length > 0) {
        // קיבוץ מניות לפי שם (ID) כדי לבצע בקשה אחת לכל מנייה
        const stocksBySymbol = {};
        israeliStocks.forEach(stock => {
          if (!stocksBySymbol[stock.stockName]) {
            stocksBySymbol[stock.stockName] = [];
          }
          stocksBySymbol[stock.stockName].push(stock);
        });

        const updatedIsraeliStocks = [];
        
        // עבור כל מנייה ייחודית, בקש נתונים פעם אחת
        for (const [stockSymbol, stocks] of Object.entries(stocksBySymbol)) {
          const priceData = await fetchIsraeliStockPrice(stockSymbol);
          
          if (priceData && priceData.currentPrice !== null) {
            // המרה מאגורות לשקלים
            const normalizedPrice = priceData.currentPrice / 100;
            
            // עדכן את כל השורות של המנייה הזו
            stocks.forEach(stock => {
              updatedIsraeliStocks.push({
                ...stock,
                currentPrice: normalizedPrice,
                dailyChangePercent: priceData.changePercent
              });
            });
          } else {
            // אם לא התקבל מחיר, שומרים את המניות עם הנתונים הקיימים
            stocks.forEach(stock => {
              updatedIsraeliStocks.push(stock);
            });
          }
        }
        
        setIsraeliStocks(updatedIsraeliStocks);
        // שמירה עם המניות האמריקאיות הנוכחיות
        setAmericanStocks(currentAmericanStocks => {
          saveToLocalStorage(updatedIsraeliStocks, currentAmericanStocks);
          return currentAmericanStocks;
        });
      }

      // עדכון מניות אמריקאיות
      if (americanStocks.length > 0) {
        // קבלת שער החליפין הנוכחי
        const currentExchangeRate = await fetchExchangeRate();
        
        // קיבוץ מניות לפי שם כדי לבצע בקשה אחת לכל מנייה
        const stocksBySymbol = {};
        americanStocks.forEach(stock => {
          if (!stocksBySymbol[stock.stockName]) {
            stocksBySymbol[stock.stockName] = [];
          }
          stocksBySymbol[stock.stockName].push(stock);
        });

        const updatedAmericanStocks = [];
        
        // עבור כל מנייה ייחודית, בקש נתונים פעם אחת
        for (const [stockSymbol, stocks] of Object.entries(stocksBySymbol)) {
          try {
            const priceData = await fetchCurrentPrice(stockSymbol);
            if (priceData !== null) {
              // עדכן את כל השורות של המנייה הזו
              stocks.forEach(stock => {
                updatedAmericanStocks.push({
                  ...stock, 
                  currentPrice: priceData.currentPrice,
                  dailyChangePercent: priceData.changePercent,
                  currentExchangeRate: currentExchangeRate || stock.currentExchangeRate || stock.exchangeRate
                });
              });
            } else {
              stocks.forEach(stock => {
                updatedAmericanStocks.push({
                  ...stock,
                  currentExchangeRate: currentExchangeRate || stock.currentExchangeRate || stock.exchangeRate
                });
              });
            }
          } catch (error) {
            stocks.forEach(stock => {
              updatedAmericanStocks.push({
                ...stock,
                currentExchangeRate: currentExchangeRate || stock.currentExchangeRate || stock.exchangeRate
              });
            });
          }
        }
        
        setAmericanStocks(updatedAmericanStocks);
        // שמירה עם המניות הישראליות הנוכחיות
        setIsraeliStocks(currentIsraeliStocks => {
          saveToLocalStorage(currentIsraeliStocks, updatedAmericanStocks);
          return currentIsraeliStocks;
        });
      }
    }, 10000); // 10 שניות

    return () => clearInterval(interval);
  }, [israeliStocks.length, americanStocks.length, isEditMode, isAddingNewStock]); // eslint-disable-line react-hooks/exhaustive-deps

  // שמירת נתונים ב-LocalStorage
  const saveToLocalStorage = (israeliData, americanData, pensionData = pensionFunds, bankData = bankBalances, cashData = cashFunds) => {
    localStorage.setItem('israeliStocks', JSON.stringify(israeliData));
    localStorage.setItem('americanStocks', JSON.stringify(americanData));
    localStorage.setItem('pensionFunds', JSON.stringify(pensionData));
    localStorage.setItem('bankBalances', JSON.stringify(bankData));
    localStorage.setItem('cashFunds', JSON.stringify(cashData));
  };

  // פונקציה לקבלת מחיר נוכחי ואחוז שינוי יומי מ-Yahoo Finance דרך proxy
  const fetchCurrentPrice = async (stockSymbol) => {
    try {
      const proxyUrl = 'https://api.allorigins.win/raw?url=';
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${stockSymbol}`;
      const response = await fetch(proxyUrl + encodeURIComponent(yahooUrl));
      const data = await response.json();
      
      if (data.chart && data.chart.result && data.chart.result.length > 0) {
        const meta = data.chart.result[0].meta;
        const currentPrice = meta.regularMarketPrice;
        
        // נסה כמה אפשרויות לאחוז שינוי
        const changePercent = meta.regularMarketChangePercent || 
                             meta.changePercent || 
                             meta.regularMarketChange || 
                             meta.change || 
                             0;
        
        // אם אין אחוז שינוי, חשב אותו בעצמי
        let finalChangePercent = 0;
        if (changePercent && changePercent !== 0) {
          finalChangePercent = changePercent * 100; // המרה לאחוזים
        } else if (meta.previousClose && meta.regularMarketPrice) {
          // חשב אחוז שינוי בעצמי
          const change = meta.regularMarketPrice - meta.previousClose;
          finalChangePercent = (change / meta.previousClose) * 100;
        }
        
        return { currentPrice, changePercent: finalChangePercent };
      }
    } catch (error) {
      return null;
    }
  };

  // פונקציה לקבלת שער החליפין הנוכחי שקל/דולר מ-Yahoo Finance
  const fetchExchangeRate = async () => {
    try {
      const proxyUrl = 'https://api.allorigins.win/raw?url=';
      const yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/USDILS=X';
      const response = await fetch(proxyUrl + encodeURIComponent(yahooUrl));
      const data = await response.json();
      
      if (data.chart && data.chart.result && data.chart.result.length > 0) {
        const currentRate = data.chart.result[0].meta.regularMarketPrice;
        return currentRate;
      }
    } catch (error) {
      return null;
    }
  };




  const handleAddInfo = () => {
    setIsEditMode(false);
    setEditingStock(null);
    setIsAddingNewStock(true);
    setShowForm(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🚀 handleSubmit נקרא!');
    console.log('📝 נתוני הטופס:', formData);
    
    // קבלת מחיר נוכחי ואחוז שינוי יומי מ-API
    let currentPrice = 0;
    let dailyChangePercent = 0;
    
    if (formData.exchange === 'american') {
      const priceData = await fetchCurrentPrice(formData.stockName.trim());
      if (priceData) {
        currentPrice = priceData.currentPrice || 0;
        dailyChangePercent = priceData.changePercent || 0;
      }
    } else if (formData.exchange === 'israeli') {
      const stockId = formData.stockName.trim();
      const priceData = await fetchIsraeliStockPrice(stockId);
      if (priceData && priceData.currentPrice !== null) {
        const normalizedPrice = priceData.currentPrice / 100; // המרה מאגורות לשקלים
        currentPrice = normalizedPrice;
        dailyChangePercent = priceData.changePercent || 0;
      }
      // אם לא מתקבל מחיר, המחיר נשאר 0 (כפי שהוגדר בתחילת הפונקציה)
    }
    
    // יצירת ושמירת אובייקט לפי סוג פריט
    if (formData.itemType === 'stock') {
      const stockData = {
        id: Date.now(),
        stockName: formData.stockName,
        purchaseDate: formData.purchaseDate,
        purchasePrice: parseFloat(formData.purchasePrice),
        quantity: parseInt(formData.quantity),
        exchangeRate: formData.exchange === 'american' ? parseFloat(formData.exchangeRate) : null,
        currentPrice: currentPrice,
        dailyChangePercent: dailyChangePercent
      };
      console.log('💾 שומר מנייה/כספית חדשה:', stockData);
      if (formData.exchange === 'israeli') {
        const updatedIsraeliStocks = [...israeliStocks, stockData];
        setIsraeliStocks(updatedIsraeliStocks);
        saveToLocalStorage(updatedIsraeliStocks, americanStocks);
      } else {
        const updatedAmericanStocks = [...americanStocks, stockData];
        setAmericanStocks(updatedAmericanStocks);
        saveToLocalStorage(israeliStocks, updatedAmericanStocks);
      }
    } else if (formData.itemType === 'cash_fund') {
      const cashItem = {
        id: Date.now(),
        fundName: formData.stockName,
        securityId: formData.securityId,
        updateDate: formData.purchaseDate,
        amount: parseFloat(formData.purchasePrice)
      };
      const updatedCashFunds = [...cashFunds, cashItem];
      setCashFunds(updatedCashFunds);
      saveToLocalStorage(israeliStocks, americanStocks, pensionFunds, bankBalances, updatedCashFunds);
    } else if (formData.itemType === 'pension') {
      const pensionItem = {
        id: Date.now(),
        fundName: formData.stockName,
        updateDate: formData.purchaseDate,
        amount: parseFloat(formData.purchasePrice)
      };
      const updatedPensionFunds = [...pensionFunds, pensionItem];
      setPensionFunds(updatedPensionFunds);
      saveToLocalStorage(israeliStocks, americanStocks, updatedPensionFunds, bankBalances);
    } else if (formData.itemType === 'bank') {
      const bankItem = {
        id: Date.now(),
        updateDate: formData.purchaseDate,
        amount: parseFloat(formData.purchasePrice)
      };
      const updatedBankBalances = [...bankBalances, bankItem];
      setBankBalances(updatedBankBalances);
      saveToLocalStorage(israeliStocks, americanStocks, pensionFunds, updatedBankBalances);
    }

    setShowForm(false);
    setIsAddingNewStock(false);
    
    // איפוס הטופס
    setFormData({
      itemType: 'stock',
      stockName: '',
      securityId: '',
      purchaseDate: '',
      purchasePrice: '',
      quantity: '',
      exchange: 'israeli',
      exchangeRate: ''
    });
  };

  const handleBackToHome = () => {
    setShowForm(false);
  };

  // פונקציה למחיקת מנייה
  const handleDelete = (id, exchange) => {
    if (exchange === 'israeli') {
      const updatedIsraeliStocks = israeliStocks.filter(stock => stock.id !== id);
      setIsraeliStocks(updatedIsraeliStocks);
      saveToLocalStorage(updatedIsraeliStocks, americanStocks);
    } else if (exchange === 'american') {
      const updatedAmericanStocks = americanStocks.filter(stock => stock.id !== id);
      setAmericanStocks(updatedAmericanStocks);
      saveToLocalStorage(israeliStocks, updatedAmericanStocks);
    } else if (exchange === 'pension') {
      const updatedPensionFunds = pensionFunds.filter(item => item.id !== id);
      setPensionFunds(updatedPensionFunds);
      saveToLocalStorage(israeliStocks, americanStocks, updatedPensionFunds, bankBalances);
    } else if (exchange === 'bank') {
      const updatedBankBalances = bankBalances.filter(item => item.id !== id);
      setBankBalances(updatedBankBalances);
      saveToLocalStorage(israeliStocks, americanStocks, pensionFunds, updatedBankBalances);
    } else if (exchange === 'cash_fund') {
      const updatedCashFunds = cashFunds.filter(item => item.id !== id);
      setCashFunds(updatedCashFunds);
      saveToLocalStorage(israeliStocks, americanStocks, pensionFunds, bankBalances, updatedCashFunds);
    }
  };


  // פונקציה לשמירת עריכה
  const handleSaveEdit = async () => {
    if (!formData.stockName || !formData.purchasePrice || !formData.quantity || !formData.purchaseDate) {
      alert('אנא מלא את כל השדות');
      return;
    }
    
    if (!editingStock) {
      alert('שגיאה: לא נמצאה מנייה לעריכה');
      return;
    }
    
    let currentPrice = editingStock.currentPrice;
    let dailyChangePercent = editingStock.dailyChangePercent;
    
    if (formData.exchange === 'american') {
      const priceData = await fetchCurrentPrice(formData.stockName.trim());
      if (priceData) {
        currentPrice = priceData.currentPrice || 0;
        dailyChangePercent = priceData.changePercent || 0;
      }
    } else if (formData.exchange === 'israeli') {
      // מנייה ישראלית - שומרים את המחיר הנוכחי ואחוז השינוי הקיימים
      // currentPrice ו-dailyChangePercent כבר מוגדרים מהערכים הקיימים
    }
    
    const updatedStock = {
      ...editingStock,
      stockName: formData.stockName,
      purchasePrice: parseFloat(formData.purchasePrice),
      quantity: parseInt(formData.quantity),
      purchaseDate: formData.purchaseDate,
      currentPrice: currentPrice,
      dailyChangePercent: dailyChangePercent
    };
    
    if (formData.exchange === 'israeli') {
      const updatedIsraeliStocks = israeliStocks.map(stock => 
        stock.id === editingStock.id ? updatedStock : stock
      );
      setIsraeliStocks(updatedIsraeliStocks);
      saveToLocalStorage(updatedIsraeliStocks, americanStocks);
    } else {
      const updatedAmericanStocks = americanStocks.map(stock => 
        stock.id === editingStock.id ? updatedStock : stock
      );
      setAmericanStocks(updatedAmericanStocks);
      saveToLocalStorage(israeliStocks, updatedAmericanStocks);
    }
    
    setIsEditMode(false);
    setEditingStock(null);
    setFormData({
      stockName: '',
      securityId: '',
      purchasePrice: '',
      quantity: '',
      purchaseDate: '',
      exchange: 'israeli',
      exchangeRate: ''
    });
  };

  // פונקציה לביטול עריכה
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditingStock(null);
    setFormData({
      stockName: '',
      securityId: '',
      purchasePrice: '',
      quantity: '',
      purchaseDate: '',
      exchange: 'israeli',
      exchangeRate: ''
    });
  };


  // פונקציה לעריכה inline
  const handleInlineEdit = (id, field, value, exchange) => {
    console.log(`✏️ עריכה: ${field} = ${value} עבור מנייה ${id}`);
    if (exchange === 'israeli') {
      const updatedIsraeliStocks = israeliStocks.map(stock => 
        stock.id === id ? { ...stock, [field]: value } : stock
      );
      setIsraeliStocks(updatedIsraeliStocks);
      saveToLocalStorage(updatedIsraeliStocks, americanStocks);
    } else if (exchange === 'american') {
      const updatedAmericanStocks = americanStocks.map(stock => 
        stock.id === id ? { ...stock, [field]: value } : stock
      );
      setAmericanStocks(updatedAmericanStocks);
      saveToLocalStorage(israeliStocks, updatedAmericanStocks);
    } else if (exchange === 'pension') {
      const updatedPensionFunds = pensionFunds.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      );
      setPensionFunds(updatedPensionFunds);
      saveToLocalStorage(israeliStocks, americanStocks, updatedPensionFunds, bankBalances);
    } else if (exchange === 'bank') {
      const updatedBankBalances = bankBalances.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      );
      setBankBalances(updatedBankBalances);
      saveToLocalStorage(israeliStocks, americanStocks, pensionFunds, updatedBankBalances);
    } else if (exchange === 'cash_fund') {
      const updatedCashFunds = cashFunds.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      );
      setCashFunds(updatedCashFunds);
      saveToLocalStorage(israeliStocks, americanStocks, pensionFunds, bankBalances, updatedCashFunds);
    }
  };

  // פונקציה להתחלת עריכה inline
  const startInlineEdit = (id, field) => {
    setEditingField(`${id}-${field}`);
  };

  // פונקציה לסיום עריכה inline
  const finishInlineEdit = () => {
    setEditingField(null);
  };

  // פונקציה לטיפול בלחיצה על תא
  const handleCellClick = (id, field, exchange) => {
    if (isEditMode) {
      startInlineEdit(id, field);
    }
  };

  // פונקציה לטיפול בלחיצה על מקש Enter
  const handleKeyPress = (e, id, field, exchange) => {
    if (e.key === 'Enter') {
      finishInlineEdit();
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL');
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined || isNaN(price)) {
      return '0.00';
    }
    return price.toFixed(2);
  };

  const formatPriceWithSign = (price) => {
    if (price === null || price === undefined || isNaN(price)) {
      return '0.00';
    }
    if (price >= 0) {
      return price.toFixed(2);
    } else {
      return `${Math.abs(price).toFixed(2)}-`;
    }
  };

  const calculateProfitPercentage = (purchaseValue, currentValue) => {
    if (purchaseValue === 0 || !purchaseValue || !currentValue) return 0;
    return ((currentValue - purchaseValue) / purchaseValue * 100).toFixed(2);
  };

  // פונקציה לקיבוץ מניות לפי שם
  const groupStocksByName = (stocks) => {
    const grouped = {};
    stocks.forEach(stock => {
      if (!grouped[stock.stockName]) {
        grouped[stock.stockName] = [];
      }
      grouped[stock.stockName].push(stock);
    });
    return grouped;
  };

  // פונקציה לחישוב סיכומים של קיבוץ
  const calculateGroupSummary = (stocks) => {
    const totalQuantity = stocks.reduce((sum, stock) => sum + (stock.quantity || 0), 0);
    const totalPurchaseValue = stocks.reduce((sum, stock) => {
      const purchaseValue = (stock.purchasePrice || 0) * (stock.quantity || 0);
      return sum + purchaseValue;
    }, 0);
    const totalCurrentValue = stocks.reduce((sum, stock) => {
      const currentValue = (stock.currentPrice || 0) * (stock.quantity || 0);
      return sum + currentValue;
    }, 0);
    const totalProfit = totalCurrentValue - totalPurchaseValue;
    const profitPercentage = calculateProfitPercentage(totalPurchaseValue, totalCurrentValue);
    
    // חישוב מחיר ממוצע משוקלל לפי הכמות
    const averagePurchasePrice = totalQuantity > 0 ? totalPurchaseValue / totalQuantity : 0;
    const averageCurrentPrice = totalQuantity > 0 ? totalCurrentValue / totalQuantity : 0;
    
    return {
      totalQuantity,
      totalPurchaseValue,
      totalCurrentValue,
      totalProfit,
      profitPercentage,
      averagePurchasePrice,
      averageCurrentPrice
    };
  };

  // פונקציה לטיפול בפתיחה/סגירה של קיבוץ
  const toggleGroup = (stockName, exchange) => {
    const key = `${exchange}-${stockName}`;
    setExpandedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // פונקציה לחישוב סיכום כללי של התיק
  const calculatePortfolioSummary = () => {
    // חישוב מניות ישראליות
    const israeliSummary = israeliStocks.reduce((acc, stock) => {
      const totalPurchase = (stock.purchasePrice || 0) * (stock.quantity || 0);
      const totalCurrentValue = (stock.currentPrice || 0) * (stock.quantity || 0);
      const profit = totalCurrentValue - totalPurchase;
      
      acc.totalPurchaseILS += totalPurchase;
      acc.totalCurrentValueILS += totalCurrentValue;
      acc.totalProfitILS += profit;
      acc.totalWeight += totalCurrentValue; // משקל לחישוב אחוז שינוי יומי
      acc.dailyChangeSum += (stock.dailyChangePercent || 0) * totalCurrentValue;
      
      return acc;
    }, {
      totalPurchaseILS: 0,
      totalCurrentValueILS: 0,
      totalProfitILS: 0,
      totalWeight: 0,
      dailyChangeSum: 0
    });

    // חישוב מניות אמריקאיות
    const americanSummary = americanStocks.reduce((acc, stock) => {
      const totalPurchaseUSD = (stock.purchasePrice || 0) * (stock.quantity || 0);
      const totalPurchaseILS = totalPurchaseUSD * (stock.exchangeRate || 0);
      const totalCurrentValueUSD = (stock.currentPrice || 0) * (stock.quantity || 0);
      const currentExchangeRate = stock.currentExchangeRate || stock.exchangeRate || 0;
      const totalCurrentValueILS = totalCurrentValueUSD * currentExchangeRate;
      
      const profitUSD = totalCurrentValueUSD - totalPurchaseUSD;
      const profitILS = profitUSD * currentExchangeRate; // רווח בדולרים כפול השער הנוכחי
      
      // השפעת שער החליפין - ההפרש בין הרווח בשער הקנייה לרווח בשער הנוכחי
      const profitAtPurchaseRate = profitUSD * (stock.exchangeRate || 0);
      const exchangeRateImpact = profitILS - profitAtPurchaseRate;
      
      acc.totalPurchaseUSD += totalPurchaseUSD;
      acc.totalPurchaseILS += totalPurchaseILS;
      acc.totalCurrentValueUSD += totalCurrentValueUSD;
      acc.totalCurrentValueILS += totalCurrentValueILS;
      acc.totalProfitUSD += profitUSD;
      acc.totalProfitILS += profitILS;
      acc.totalExchangeImpact += exchangeRateImpact;
      acc.totalWeight += totalCurrentValueILS; // משקל לחישוב אחוז שינוי יומי
      acc.dailyChangeSum += (stock.dailyChangePercent || 0) * totalCurrentValueILS;
      
      return acc;
    }, {
      totalPurchaseUSD: 0,
      totalPurchaseILS: 0,
      totalCurrentValueUSD: 0,
      totalCurrentValueILS: 0,
      totalProfitUSD: 0,
      totalProfitILS: 0,
      totalExchangeImpact: 0,
      totalWeight: 0,
      dailyChangeSum: 0
    });

    // חישוב אחוז שינוי יומי משוקלל
    const totalWeight = israeliSummary.totalWeight + americanSummary.totalWeight;
    const weightedDailyChange = totalWeight > 0 ? 
      (israeliSummary.dailyChangeSum + americanSummary.dailyChangeSum) / totalWeight : 0;

    // חישוב רווח יומי בשקלים ובדולרים
    const dailyProfitILS = (weightedDailyChange / 100) * (israeliSummary.totalCurrentValueILS + americanSummary.totalCurrentValueILS);
    const dailyProfitUSD = (weightedDailyChange / 100) * americanSummary.totalCurrentValueUSD;

    // רווח יומי נפרד לכל בורסה
    const israeliDailyProfitILS = israeliStocks.reduce((sum, stock) => {
      const totalCurrentValue = (stock.currentPrice || 0) * (stock.quantity || 0);
      return sum + ((stock.dailyChangePercent || 0) / 100) * totalCurrentValue;
    }, 0);

    const americanDailyProfitUSD = americanStocks.reduce((sum, stock) => {
      const totalCurrentValueUSD = (stock.currentPrice || 0) * (stock.quantity || 0);
      return sum + ((stock.dailyChangePercent || 0) / 100) * totalCurrentValueUSD;
    }, 0);

    // אחוזי רווח כוללים פר בורסה
    const israeliProfitILS = israeliSummary.totalCurrentValueILS - israeliSummary.totalPurchaseILS;
    const israeliTaxILS = israeliProfitILS > 0 ? israeliProfitILS * 0.25 : 0;
    const israeliAfterTaxILS = israeliProfitILS - israeliTaxILS;
    const israeliProfitPercent = israeliSummary.totalPurchaseILS > 0 ? (israeliProfitILS / israeliSummary.totalPurchaseILS) * 100 : 0;
    const israeliDailyPercent = israeliSummary.totalCurrentValueILS > 0 ? (israeliDailyProfitILS / israeliSummary.totalCurrentValueILS) * 100 : 0;

    const americanProfitUSD = americanSummary.totalCurrentValueUSD - americanSummary.totalPurchaseUSD;
    const americanTaxUSD = americanProfitUSD > 0 ? americanProfitUSD * 0.25 : 0;
    const americanAfterTaxUSD = americanProfitUSD - americanTaxUSD;
    const americanProfitPercent = americanSummary.totalPurchaseUSD > 0 ? (americanProfitUSD / americanSummary.totalPurchaseUSD) * 100 : 0;
    const americanDailyPercent = americanSummary.totalCurrentValueUSD > 0 ? (americanDailyProfitUSD / americanSummary.totalCurrentValueUSD) * 100 : 0;

    // סה"כ מצב ההון לפי קטגוריות
    const cashFundsTotalILS = cashFunds.reduce((sum, item) => sum + (item.amount || 0), 0);
    const pensionFundsTotalILS = pensionFunds.reduce((sum, item) => sum + (item.amount || 0), 0);
    const bankBalancesTotalILS = bankBalances.reduce((sum, item) => sum + (item.amount || 0), 0);
    const capitalIsraeliILS = israeliSummary.totalCurrentValueILS;
    const capitalAmericanILS = americanSummary.totalCurrentValueILS;
    const capitalTotalILS = capitalIsraeliILS + capitalAmericanILS + cashFundsTotalILS + pensionFundsTotalILS + bankBalancesTotalILS;

    return {
      // סיכום בשקלים
      totalPurchaseILS: israeliSummary.totalPurchaseILS + americanSummary.totalPurchaseILS,
      totalCurrentValueILS: israeliSummary.totalCurrentValueILS + americanSummary.totalCurrentValueILS,
      totalProfitILS: israeliSummary.totalProfitILS + americanSummary.totalProfitILS,

      // סיכום ישראלי בלבד
      israeliOnlyPurchaseILS: israeliSummary.totalPurchaseILS,
      israeliOnlyCurrentValueILS: israeliSummary.totalCurrentValueILS,
      israeliOnlyProfitILS: israeliSummary.totalProfitILS,
      israeliOnlyTaxILS: israeliTaxILS,
      israeliOnlyAfterTaxILS: israeliAfterTaxILS,
      israeliOnlyProfitPercent: israeliProfitPercent,
      israeliOnlyDailyPercent: israeliDailyPercent,
      israeliOnlyDailyProfitILS: israeliDailyProfitILS,
      
      // סיכום בדולרים
      totalPurchaseUSD: americanSummary.totalPurchaseUSD,
      totalCurrentValueUSD: americanSummary.totalCurrentValueUSD,
      totalProfitUSD: americanSummary.totalProfitUSD,
      americanOnlyTaxUSD: americanTaxUSD,
      americanOnlyAfterTaxUSD: americanAfterTaxUSD,
      americanOnlyProfitPercent: americanProfitPercent,
      americanOnlyDailyPercent: americanDailyPercent,
      americanOnlyDailyProfitUSD: americanDailyProfitUSD,
      
      // אחוז שינוי יומי משוקלל
      weightedDailyChange: weightedDailyChange,
      
      // רווח יומי בשקלים ובדולרים
      dailyProfitILS: dailyProfitILS,
      dailyProfitUSD: dailyProfitUSD,
      israeliDailyProfitILS: israeliDailyProfitILS,
      americanDailyProfitUSD: americanDailyProfitUSD,
      
      // השפעת שער חליפין כוללת
      totalExchangeImpact: americanSummary.totalExchangeImpact,

      // מצב הון
      capitalIsraeliILS,
      capitalAmericanILS,
      capitalCashFundsILS: cashFundsTotalILS,
      capitalPensionILS: pensionFundsTotalILS,
      capitalBankILS: bankBalancesTotalILS,
      capitalTotalILS
    };
  };

  // פונקציות לניתוח התיק
  const calculatePortfolioAnalysis = () => {
    // ניתוח פיזור לפי בורסות
    const israeliTotalValue = israeliStocks.reduce((sum, stock) => {
      return sum + ((stock.currentPrice || 0) * (stock.quantity || 0));
    }, 0);

    const americanTotalValueILS = americanStocks.reduce((sum, stock) => {
      const currentExchangeRate = stock.currentExchangeRate || stock.exchangeRate || 0;
      return sum + ((stock.currentPrice || 0) * (stock.quantity || 0) * currentExchangeRate);
    }, 0);

    const totalValueILS = israeliTotalValue + americanTotalValueILS;

    // ניתוח פיזור לפי מניות
    const stockDistribution = {};
    
    // מניות ישראליות
    israeliStocks.forEach(stock => {
      const value = (stock.currentPrice || 0) * (stock.quantity || 0);
      const purchaseValue = (stock.purchasePrice || 0) * (stock.quantity || 0);
      const profit = value - purchaseValue;
      
      // חישוב זמן החזקה
      const purchaseDate = new Date(stock.purchaseDate);
      const currentDate = new Date();
      const daysHeld = Math.floor((currentDate - purchaseDate) / (1000 * 60 * 60 * 24));
      const yearsHeld = daysHeld / 365;
      
      
      if (!stockDistribution[stock.stockName]) {
        stockDistribution[stock.stockName] = {
          name: stock.stockName,
          value: 0,
          percentage: 0,
          exchange: 'israeli',
          profit: 0,
          profitPercentage: 0,
          totalQuantity: 0,
          avgPurchasePrice: 0,
          totalPurchaseValue: 0,
          daysHeld: 0,
          yearsHeld: 0,
          annualizedReturn: 0,
          dailyChange: 0,
          volatility: 0
        };
      }
      
      stockDistribution[stock.stockName].value += value;
      stockDistribution[stock.stockName].profit += profit;
      stockDistribution[stock.stockName].totalQuantity += (stock.quantity || 0);
      stockDistribution[stock.stockName].totalPurchaseValue += purchaseValue;
      stockDistribution[stock.stockName].daysHeld = Math.max(stockDistribution[stock.stockName].daysHeld, daysHeld);
      stockDistribution[stock.stockName].yearsHeld = Math.max(stockDistribution[stock.stockName].yearsHeld, yearsHeld);
      stockDistribution[stock.stockName].dailyChange = stock.dailyChangePercent || 0;
      
      // חישוב תשואה שנתית
      if (yearsHeld > 0 && purchaseValue > 0) {
        const annualizedReturn = Math.pow((value / purchaseValue), (1 / yearsHeld)) - 1;
        stockDistribution[stock.stockName].annualizedReturn = annualizedReturn;
      }
    });

    // מניות אמריקאיות
    americanStocks.forEach(stock => {
      const currentExchangeRate = stock.currentExchangeRate || stock.exchangeRate || 0;
      const value = (stock.currentPrice || 0) * (stock.quantity || 0) * currentExchangeRate;
      const purchaseValue = (stock.purchasePrice || 0) * (stock.quantity || 0) * currentExchangeRate;
      const profit = value - purchaseValue;
      
      // חישוב זמן החזקה
      const purchaseDate = new Date(stock.purchaseDate);
      const currentDate = new Date();
      const daysHeld = Math.floor((currentDate - purchaseDate) / (1000 * 60 * 60 * 24));
      const yearsHeld = daysHeld / 365;
      
      
      if (!stockDistribution[stock.stockName]) {
        stockDistribution[stock.stockName] = {
          name: stock.stockName,
          value: 0,
          percentage: 0,
          exchange: 'american',
          profit: 0,
          profitPercentage: 0,
          totalQuantity: 0,
          avgPurchasePrice: 0,
          totalPurchaseValue: 0,
          daysHeld: 0,
          yearsHeld: 0,
          annualizedReturn: 0,
          dailyChange: 0,
          volatility: 0
        };
      }
      
      stockDistribution[stock.stockName].value += value;
      stockDistribution[stock.stockName].profit += profit;
      stockDistribution[stock.stockName].totalQuantity += (stock.quantity || 0);
      stockDistribution[stock.stockName].totalPurchaseValue += purchaseValue;
      stockDistribution[stock.stockName].daysHeld = Math.max(stockDistribution[stock.stockName].daysHeld, daysHeld);
      stockDistribution[stock.stockName].yearsHeld = Math.max(stockDistribution[stock.stockName].yearsHeld, yearsHeld);
      stockDistribution[stock.stockName].dailyChange = stock.dailyChangePercent || 0;
      
      // חישוב תשואה שנתית
      if (yearsHeld > 0 && purchaseValue > 0) {
        const annualizedReturn = Math.pow((value / purchaseValue), (1 / yearsHeld)) - 1;
        stockDistribution[stock.stockName].annualizedReturn = annualizedReturn;
      }
    });

    // חישוב נתונים נוספים
    Object.values(stockDistribution).forEach(stock => {
      stock.percentage = totalValueILS > 0 ? (stock.value / totalValueILS) * 100 : 0;
      stock.profitPercentage = stock.totalPurchaseValue > 0 ? (stock.profit / stock.totalPurchaseValue) * 100 : 0;
      stock.avgPurchasePrice = stock.totalQuantity > 0 ? stock.totalPurchaseValue / stock.totalQuantity : 0;
      
      // חישוב תשואה שנתית כוללת
      if (stock.yearsHeld > 0 && stock.totalPurchaseValue > 0) {
        stock.annualizedReturn = Math.pow((stock.value / stock.totalPurchaseValue), (1 / stock.yearsHeld)) - 1;
      }
      
      // חישוב וולטיליות (פשטני)
      stock.volatility = Math.abs(stock.dailyChange) * 1.5; // קירוב פשטני לוולטיליות
    });

    // ניתוח פיזור לפי תאריכי קנייה
    const monthlyDistribution = {};
    const yearlyDistribution = {};
    
    [...israeliStocks, ...americanStocks].forEach(stock => {
      const date = new Date(stock.purchaseDate);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const year = date.getFullYear();
      
      const value = stock.exchange === 'israeli' 
        ? (stock.currentPrice || 0) * (stock.quantity || 0)
        : (stock.currentPrice || 0) * (stock.quantity || 0) * (stock.currentExchangeRate || stock.exchangeRate || 0);
      
      if (!monthlyDistribution[month]) {
        monthlyDistribution[month] = { value: 0, count: 0 };
      }
      monthlyDistribution[month].value += value;
      monthlyDistribution[month].count += 1;
      
      if (!yearlyDistribution[year]) {
        yearlyDistribution[year] = { value: 0, count: 0 };
      }
      yearlyDistribution[year].value += value;
      yearlyDistribution[year].count += 1;
    });

    // דוחות מפורטים
    const topPerformers = Object.values(stockDistribution)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    const worstPerformers = Object.values(stockDistribution)
      .sort((a, b) => a.profit - b.profit)
      .slice(0, 5);

    const largestPositions = Object.values(stockDistribution)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      // פיזור לפי בורסות
      exchangeDistribution: {
        israeli: {
          value: israeliTotalValue,
          percentage: totalValueILS > 0 ? (israeliTotalValue / totalValueILS) * 100 : 0
        },
        american: {
          value: americanTotalValueILS,
          percentage: totalValueILS > 0 ? (americanTotalValueILS / totalValueILS) * 100 : 0
        },
        total: totalValueILS
      },
      
      // פיזור לפי מניות
      stockDistribution: Object.values(stockDistribution).sort((a, b) => b.value - a.value),
      
      // פיזור לפי תאריכים
      monthlyDistribution: Object.entries(monthlyDistribution)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({ month, ...data })),
      
      yearlyDistribution: Object.entries(yearlyDistribution)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([year, data]) => ({ year, ...data })),
      
      // דוחות מפורטים
      reports: {
        topPerformers,
        worstPerformers,
        largestPositions
      }
    };
  };

  if (showForm) {
    return (
      <div className="App">
        <div className="form-container">
          <div className="form-content">
            <h1 className="form-title">{isEditMode ? 'עריכת מנייה' : 'הוספת מידע על מנייה'}</h1>
            
            <form onSubmit={handleSubmit} className="stock-form">
              {/* סוג פריט להוספה */}
              <div className="form-group">
                <label htmlFor="itemType">מה להוסיף</label>
                <select
                  id="itemType"
                  name="itemType"
                  value={formData.itemType}
                  onChange={handleInputChange}
                >
                  <option value="stock">מנייה</option>
                  <option value="pension">קופת גמל</option>
                  <option value="bank">עו"ש</option>
                  <option value="cash_fund">כספית שקלית</option>
                </select>
              </div>
              {formData.itemType === 'stock' && (
                <div className="form-group">
                  <label htmlFor="stockName">
                    {formData.exchange === 'israeli' ? 'ID מנייה מ-TASE *' : 'שם מנייה *'}
                  </label>
                  <input
                    type="text"
                    id="stockName"
                    name="stockName"
                    value={formData.stockName}
                    onChange={handleInputChange}
                    required
                    placeholder={formData.exchange === 'israeli' ? 'לדוגמה: 1159243 (ID של המנייה מ-TASE)' : 'לדוגמה: AAPL, MSFT, TSLA'}
                  />
                  {formData.exchange === 'israeli' && (
                    <small className="form-help">
                      עבור מניות ישראליות, הזן את ה-ID של המנייה מ-TASE (מספר כמו 1159243)
                    </small>
                  )}
                </div>
              )}

              {formData.itemType === 'pension' && (
                <div className="form-group">
                  <label htmlFor="stockName">שם קופה *</label>
                  <input
                    type="text"
                    id="stockName"
                    name="stockName"
                    value={formData.stockName}
                    onChange={handleInputChange}
                    required
                    placeholder="לדוגמה: קופת גמל להשקעה X"
                  />
                </div>
              )}

              {formData.itemType === 'cash_fund' && (
                <div className="form-group">
                  <label htmlFor="securityId">מספר נייר ערך *</label>
                  <input
                    type="text"
                    id="securityId"
                    name="securityId"
                    value={formData.securityId}
                    onChange={handleInputChange}
                    required
                    placeholder="לדוגמה: 5119609"
                  />
                </div>
              )}

              {(formData.itemType === 'stock' || formData.itemType === 'pension' || formData.itemType === 'bank' || formData.itemType === 'cash_fund') && (
                <div className="form-group">
                  <label htmlFor="purchaseDate">{formData.itemType === 'stock' ? 'תאריך קנייה *' : 'תאריך עדכון *'}</label>
                  <input
                    type="date"
                    id="purchaseDate"
                    name="purchaseDate"
                    value={formData.purchaseDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              )}

              {formData.itemType === 'stock' ? (
                <div className="form-group">
                  <label htmlFor="purchasePrice">מחיר קנייה *</label>
                  <input
                    type="number"
                    id="purchasePrice"
                    name="purchasePrice"
                    value={formData.purchasePrice}
                    onChange={handleInputChange}
                    required
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>
              ) : formData.itemType === 'pension' ? (
                <div className="form-group">
                  <label htmlFor="purchasePrice">סכום בקופה *</label>
                  <input
                    type="number"
                    id="purchasePrice"
                    name="purchasePrice"
                    value={formData.purchasePrice}
                    onChange={handleInputChange}
                    required
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>
              ) : formData.itemType === 'bank' ? (
                <div className="form-group">
                  <label htmlFor="purchasePrice">סכום בעו"ש *</label>
                  <input
                    type="number"
                    id="purchasePrice"
                    name="purchasePrice"
                    value={formData.purchasePrice}
                    onChange={handleInputChange}
                    required
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>
              ) : formData.itemType === 'cash_fund' ? (
                <div className="form-group">
                  <label htmlFor="purchasePrice">סכום *</label>
                  <input
                    type="number"
                    id="purchasePrice"
                    name="purchasePrice"
                    value={formData.purchasePrice}
                    onChange={handleInputChange}
                    required
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>
              ) : null}

              {formData.itemType === 'stock' && (
                <div className="form-group">
                  <label htmlFor="quantity">כמות *</label>
                  <input
                    type="number"
                    id="quantity"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    required
                    min="1"
                    placeholder="1"
                  />
                </div>
              )}


              {formData.itemType === 'stock' && (
                <div className="form-group">
                  <label htmlFor="exchange">בורסה *</label>
                  <select
                    id="exchange"
                    name="exchange"
                    value={formData.exchange}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="israeli">בורסה ישראלית</option>
                    <option value="american">בורסה אמריקאית</option>
                  </select>
                </div>
              )}

              {formData.itemType === 'stock' && formData.exchange === 'american' && (
                <div className="form-group">
                  <label htmlFor="exchangeRate">שער חליפין ביום הקנייה *</label>
                  <input
                    type="number"
                    id="exchangeRate"
                    name="exchangeRate"
                    value={formData.exchangeRate}
                    onChange={handleInputChange}
                    required={formData.exchange === 'american'}
                    step="0.0001"
                    min="0"
                    placeholder="3.5000"
                  />
                </div>
              )}

              <div className="form-buttons">
                <button type="button" onClick={handleBackToHome} className="back-button">
                  חזרה לדף הבית
                </button>
                {isEditMode ? (
                  <>
                    <button type="button" onClick={handleSaveEdit} className="submit-button">
                      שמור שינויים
                    </button>
                    <button type="button" onClick={handleCancelEdit} className="cancel-button">
                      ביטול
                    </button>
                  </>
                ) : (
                  <button type="submit" className="submit-button">
                    שמור מידע
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (showAnalysis) {
    const analysis = calculatePortfolioAnalysis();
    
    return (
      <div className="App">
        <div className="analysis-container">
          <div className="analysis-content">
            <h1 className="analysis-title">ניתוח התיק</h1>
            
            {/* כפתור חזרה */}
            <button className="back-button" onClick={() => setShowAnalysis(false)}>
              חזרה לדף הבית
            </button>

            {/* ניתוח פיזור לפי בורסות */}
            <div className="analysis-section">
              <h2 className="section-title">פיזור לפי בורסות</h2>
              <div className="distribution-grid">
                <div className="distribution-card">
                  <h3>בורסה ישראלית</h3>
                  <div className="distribution-value">
                    {formatPriceWithSign(analysis.exchangeDistribution.israeli.value)} ₪
                  </div>
                  <div className="distribution-percentage">
                    {analysis.exchangeDistribution.israeli.percentage.toFixed(1)}%
                  </div>
                </div>
                <div className="distribution-card">
                  <h3>בורסה אמריקאית</h3>
                  <div className="distribution-value">
                    {formatPriceWithSign(analysis.exchangeDistribution.american.value)} ₪
                  </div>
                  <div className="distribution-percentage">
                    {analysis.exchangeDistribution.american.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* גרף עוגה לפיזור התיק */}
            <div className="analysis-section">
              <h2 className="section-title">גרף עוגה - פיזור התיק</h2>
              <div className="pie-chart-container">
                <div className="pie-chart-wrapper">
                  <ResponsiveContainer width="60%" height={400}>
                    <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }} key="pie-chart">
                      <Pie
                        key="pie-data"
                        data={[
                          {
                            name: 'בורסה ישראלית',
                            value: analysis.exchangeDistribution.israeli.value,
                            percentage: analysis.exchangeDistribution.israeli.percentage
                          },
                          {
                            name: 'בורסה אמריקאית',
                            value: analysis.exchangeDistribution.american.value,
                            percentage: analysis.exchangeDistribution.american.percentage
                          }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#667eea" />
                        <Cell fill="#764ba2" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* תוויות בצד */}
                  <div className="pie-labels-side">
                    <div className="pie-label-item">
                      <div className="label-color" style={{backgroundColor: '#667eea'}}></div>
                      <div className="label-content">
                        <div className="label-name">בורסה ישראלית</div>
                        <div className="label-value">{formatPriceWithSign(analysis.exchangeDistribution.israeli.value)} ₪</div>
                        <div className="label-percentage">{analysis.exchangeDistribution.israeli.percentage.toFixed(1)}%</div>
                      </div>
                    </div>
                    <div className="pie-label-item">
                      <div className="label-color" style={{backgroundColor: '#764ba2'}}></div>
                      <div className="label-content">
                        <div className="label-name">בורסה אמריקאית</div>
                        <div className="label-value">{formatPriceWithSign(analysis.exchangeDistribution.american.value)} ₪</div>
                        <div className="label-percentage">{analysis.exchangeDistribution.american.percentage.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ניתוח פיזור לפי מניות */}
            <div className="analysis-section">
              <h2 className="section-title">פיזור לפי מניות</h2>
              <div className="stocks-table-container">
                <table className="analysis-table">
                  <thead>
                    <tr>
                      <th>מנייה</th>
                      <th>בורסה</th>
                      <th>שווי נוכחי</th>
                      <th>אחוז מהתיק</th>
                      <th>רווח/הפסד</th>
                      <th>אחוז רווח/הפסד</th>
                      <th>זמן החזקה</th>
                      <th>תשואה שנתית</th>
                      <th>וולטיליות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.stockDistribution.map((stock, index) => (
                      <tr key={index}>
                        <td>{stock.name}</td>
                        <td>{stock.exchange === 'israeli' ? 'ישראלית' : 'אמריקאית'}</td>
                        <td>{formatPriceWithSign(stock.value)} ₪</td>
                        <td>{stock.percentage.toFixed(1)}%</td>
                        <td className={stock.profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                          {formatPriceWithSign(stock.profit)} ₪
                        </td>
                        <td className={stock.profitPercentage >= 0 ? 'profit-positive' : 'profit-negative'}>
                          {stock.profitPercentage.toFixed(1)}%
                        </td>
                        <td>{stock.daysHeld > 365 ? `${stock.yearsHeld.toFixed(1)} שנים` : `${stock.daysHeld} ימים`}</td>
                        <td className={stock.annualizedReturn >= 0 ? 'profit-positive' : 'profit-negative'}>
                          {(stock.annualizedReturn * 100).toFixed(1)}%
                        </td>
                        <td>
                          <span className={`volatility-indicator ${stock.volatility > 3 ? 'high' : stock.volatility > 1.5 ? 'medium' : 'low'}`}>
                            {stock.volatility.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ניתוח פיזור לפי תאריכי קנייה */}
            <div className="analysis-section">
              <h2 className="section-title">פיזור לפי תאריכי קנייה</h2>
              <div className="date-distribution-grid">
                <div className="date-distribution-card">
                  <h3>פיזור חודשי</h3>
                  <div className="date-list">
                    {analysis.monthlyDistribution.map((item, index) => (
                      <div key={index} className="date-item">
                        <span className="date-label">{item.month}</span>
                        <span className="date-value">{formatPriceWithSign(item.value)} ₪</span>
                        <span className="date-count">({item.count} מניות)</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="date-distribution-card">
                  <h3>פיזור שנתי</h3>
                  <div className="date-list">
                    {analysis.yearlyDistribution.map((item, index) => (
                      <div key={index} className="date-item">
                        <span className="date-label">{item.year}</span>
                        <span className="date-value">{formatPriceWithSign(item.value)} ₪</span>
                        <span className="date-count">({item.count} מניות)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* דוחות מפורטים */}
            <div className="analysis-section">
              <h2 className="section-title">דוחות מפורטים</h2>
              <div className="reports-grid">
                <div className="report-card">
                  <h3>המניות הכי רווחיות</h3>
                  <div className="report-list">
                    {analysis.reports.topPerformers.map((stock, index) => (
                      <div key={index} className="report-item">
                        <span className="report-name">{stock.name}</span>
                        <span className="report-profit profit-positive">
                          {formatPriceWithSign(stock.profit)} ₪
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="report-card">
                  <h3>המניות הכי מפסידות</h3>
                  <div className="report-list">
                    {analysis.reports.worstPerformers.map((stock, index) => (
                      <div key={index} className="report-item">
                        <span className="report-name">{stock.name}</span>
                        <span className="report-profit profit-negative">
                          {formatPriceWithSign(stock.profit)} ₪
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="report-card">
                  <h3>הפוזיציות הכי גדולות</h3>
                  <div className="report-list">
                    {analysis.reports.largestPositions.map((stock, index) => (
                      <div key={index} className="report-item">
                        <span className="report-name">{stock.name}</span>
                        <span className="report-value">
                          {formatPriceWithSign(stock.value)} ₪
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="welcome-container">
        <div className="welcome-content">
          <h1 className="welcome-title">תיק ההשקעות שלך</h1>
          
          {/* סיכום התיק */}
          {(israeliStocks.length > 0 || americanStocks.length > 0) && (
            <div className="portfolio-summary">
              <h2 className="portfolio-summary-title">סיכום התיק</h2>
              {(() => {
                const summary = calculatePortfolioSummary();
                return (
                  <div className="summary-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* שורה עליונה: בורסה ישראל + בורסה אמריקאית */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
                      {/* בורסה ישראל */}
                      <div className="summary-section" style={{ flex: 1 }}>
                        <h3 className="summary-section-title">בורסה ישראל (₪)</h3>
                        <div className="summary-item">
                          <span className="summary-label">סה"כ השקעה:</span>
                          <span className="summary-value">{formatPriceWithSign(summary.israeliOnlyPurchaseILS)} ₪</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">סה"כ שווי:</span>
                          <span className="summary-value">{formatPriceWithSign(summary.israeliOnlyCurrentValueILS)} ₪</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">סה"כ רווח/הפסד:</span>
                          <span className={`summary-value ${summary.israeliOnlyProfitILS >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                            {formatPriceWithSign(summary.israeliOnlyProfitILS)} ₪
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">מס רווח הון (₪):</span>
                          <span className={`summary-value profit-negative`}>
                            {formatPriceWithSign(-summary.israeliOnlyTaxILS)} ₪
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">רווח לאחר מס (₪):</span>
                          <span className={`summary-value ${summary.israeliOnlyAfterTaxILS >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                            {formatPriceWithSign(summary.israeliOnlyAfterTaxILS)} ₪
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">אחוז רווח/הפסד כללי:</span>
                          <span className={`summary-value ${summary.israeliOnlyProfitPercent >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                            {summary.israeliOnlyProfitPercent.toFixed(2)}%
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">אחוז רווח/הפסד יומי:</span>
                          <span className={`summary-value ${summary.israeliOnlyDailyPercent >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                            {summary.israeliOnlyDailyPercent.toFixed(2)}%
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">רווח/הפסד יומי:</span>
                          <span className={`summary-value ${summary.israeliOnlyDailyProfitILS >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                            {formatPriceWithSign(summary.israeliOnlyDailyProfitILS)} ₪
                          </span>
                        </div>
                      </div>

                      {/* בורסה אמריקאית */}
                      <div className="summary-section" style={{ flex: 1 }}>
                        <h3 className="summary-section-title">בורסה אמריקאית ($)</h3>
                        <div className="summary-item">
                          <span className="summary-label">סה"כ השקעה:</span>
                          <span className="summary-value">{formatPriceWithSign(summary.totalPurchaseUSD)} $</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">סה"כ שווי:</span>
                          <span className="summary-value">{formatPriceWithSign(summary.totalCurrentValueUSD)} $</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">סה"כ רווח/הפסד:</span>
                          <span className={`summary-value ${summary.totalProfitUSD >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                            {formatPriceWithSign(summary.totalProfitUSD)} $
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">מס רווח הון ($):</span>
                          <span className={`summary-value profit-negative`}>
                            {formatPriceWithSign(-summary.americanOnlyTaxUSD)} $
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">רווח לאחר מס ($):</span>
                          <span className={`summary-value ${summary.americanOnlyAfterTaxUSD >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                            {formatPriceWithSign(summary.americanOnlyAfterTaxUSD)} $
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">אחוז רווח/הפסד כללי:</span>
                          <span className={`summary-value ${summary.americanOnlyProfitPercent >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                            {summary.americanOnlyProfitPercent.toFixed(2)}%
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">אחוז רווח/הפסד יומי:</span>
                          <span className={`summary-value ${summary.americanOnlyDailyPercent >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                            {summary.americanOnlyDailyPercent.toFixed(2)}%
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">רווח/הפסד יומי:</span>
                          <span className={`summary-value ${summary.americanOnlyDailyProfitUSD >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                            {formatPriceWithSign(summary.americanOnlyDailyProfitUSD)} $
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* שורה תחתונה: סה"כ מצב ההון + סיכום כולל */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
                      {/* סה"כ מצב ההון */}
                      <div className="summary-section" style={{ flex: 1 }}>
                        <h3 className="summary-section-title">סה"כ מצב ההון</h3>
                        <div className="summary-item">
                          <span className="summary-label">בורסה ישראלית:</span>
                          <span className="summary-value">{formatPriceWithSign(summary.capitalIsraeliILS)} ₪</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">בורסה אמריקאית:</span>
                          <span className="summary-value">{formatPriceWithSign(summary.capitalAmericanILS)} ₪</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">כספית שקלית:</span>
                          <span className="summary-value">{formatPriceWithSign(summary.capitalCashFundsILS)} ₪</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">קופת גמל:</span>
                          <span className="summary-value">{formatPriceWithSign(summary.capitalPensionILS)} ₪</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">עו"ש:</span>
                          <span className="summary-value">{formatPriceWithSign(summary.capitalBankILS)} ₪</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">סה"כ מצב ההון:</span>
                          <span className="summary-value">{formatPriceWithSign(summary.capitalTotalILS)} ₪</span>
                        </div>
                      </div>

                      {/* סיכום כולל */}
                      <div className="summary-section" style={{ flex: 1 }}>
                        <h3 className="summary-section-title">סיכום כולל (₪)</h3>
                        <div className="summary-item">
                          <span className="summary-label">סה"כ השקעה בש"ח:</span>
                          <span className="summary-value">{formatPriceWithSign(summary.totalPurchaseILS)} ₪</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">סה"כ שווי בש"ח:</span>
                          <span className="summary-value">{formatPriceWithSign(summary.totalCurrentValueILS)} ₪</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">סה"כ רווח /הפסד בש"ח:</span>
                          <span className={`summary-value ${summary.totalProfitILS >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                            {formatPriceWithSign(summary.totalProfitILS)} ₪
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">השפעת שער חליפין:</span>
                          <span className={`summary-value ${summary.totalExchangeImpact >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                            {formatPriceWithSign(summary.totalExchangeImpact)} ₪
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          
          <div className="main-buttons-container">
            <button className="add-info-button" onClick={handleAddInfo}>
              הוספת מידע חדש
            </button>
            <button className="analysis-button" onClick={() => setShowAnalysis(true)}>
              ניתוח התיק
            </button>

            {/* כפתורי בקרה */}
            <div className="control-buttons">
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`btn ${isEditMode ? 'btn-danger' : 'btn-warning'}`}
              >
                {isEditMode ? 'יציאה ממצב עריכה' : 'מצב עריכה'}
              </button>
              
              <button
                onClick={() => setShowAmericanColumns(!showAmericanColumns)}
                className="btn btn-info"
              >
                {showAmericanColumns ? 'הסתר עמודות אמריקאיות' : 'הצגת נתונים נוספים בבורסה אמריקאית'}
              </button>
            </div>
            
            {/* הודעה על מצב עריכה */}
            {isEditMode && (
              <div className="edit-mode-notice">
                <div className="notice-content">
                  <span className="notice-icon">✏️</span>
                  <span className="notice-text">מצב עריכה פעיל - לחץ על תאים לעריכה</span>
                </div>
              </div>
            )}
          </div>

          {/* טבלת בורסה ישראלית */}
          {israeliStocks.length > 0 && (
            <div className="stocks-section">
              <h2 className="section-title">בורסה ישראלית</h2>
              <div className="table-container">
                <table className="stocks-table">
                  <thead>
                    <tr>
                      <th>שם מנייה</th>
                      <th>תאריך קנייה</th>
                      <th>מחיר קנייה (₪)</th>
                      <th>כמות</th>
                      <th>סה"כ קנייה בש"ח</th>
                      <th>מחיר נוכחי (₪)</th>
                      <th>סה"כ שווי היום (₪)</th>
                      <th>סה"כ רווח/הפסד בש"ח</th>
                      <th>מס רווח הון (₪)</th>
                      <th>רווח לאחר מס (₪)</th>
                      <th>אחוז רווח/הפסד</th>
                      <th>אחוז שינוי יומי</th>
                      <th>רווח/הפסד יומי בש"ח</th>
                      {isEditMode && <th>פעולות</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupStocksByName(israeliStocks)).map(([stockName, stocks]) => {
                      const isExpanded = expandedGroups[`israeli-${stockName}`];
                      const summary = calculateGroupSummary(stocks);
                      
                      // אם יש רק מנייה אחת, הצג אותה כרגיל ללא קיבוץ
                      if (stocks.length === 1) {
                        const stock = stocks[0];
                        const totalPurchase = (stock.purchasePrice || 0) * (stock.quantity || 0);
                        const totalCurrentValue = (stock.currentPrice || 0) * (stock.quantity || 0);
                        const profit = totalCurrentValue - totalPurchase;
                        const profitPercentage = calculateProfitPercentage(totalPurchase, totalCurrentValue);
                        const capitalGainsTaxILS = profit > 0 ? profit * 0.25 : 0;
                        const afterTaxProfitILS = profit - capitalGainsTaxILS;
                        
                        return (
                          <tr 
                            key={stock.id}
                            className={isEditMode ? 'editable-row' : ''}
                          >
                            <td 
                              onClick={() => handleCellClick(stock.id, 'stockName', 'israeli')}
                              className={isEditMode ? 'editable-cell' : ''}
                            >
                              {editingField === `${stock.id}-stockName` ? (
                                <input
                                  type="text"
                                  value={stock.stockName}
                                  onChange={(e) => handleInlineEdit(stock.id, 'stockName', e.target.value, 'israeli')}
                                  onBlur={finishInlineEdit}
                                  onKeyPress={(e) => handleKeyPress(e, stock.id, 'stockName', 'israeli')}
                                  autoFocus
                                />
                              ) : (
                                stock.stockName
                              )}
                            </td>
                            <td 
                              onClick={() => handleCellClick(stock.id, 'purchaseDate', 'israeli')}
                              className={isEditMode ? 'editable-cell' : ''}
                            >
                              {editingField === `${stock.id}-purchaseDate` ? (
                                <input
                                  type="date"
                                  value={stock.purchaseDate}
                                  onChange={(e) => handleInlineEdit(stock.id, 'purchaseDate', e.target.value, 'israeli')}
                                  onBlur={finishInlineEdit}
                                  onKeyPress={(e) => handleKeyPress(e, stock.id, 'purchaseDate', 'israeli')}
                                  autoFocus
                                />
                              ) : (
                                formatDate(stock.purchaseDate)
                              )}
                            </td>
                            <td 
                              onClick={() => handleCellClick(stock.id, 'purchasePrice', 'israeli')}
                              className={isEditMode ? 'editable-cell' : ''}
                            >
                              {editingField === `${stock.id}-purchasePrice` ? (
                                <input
                                  type="number"
                                  value={stock.purchasePrice}
                                  onChange={(e) => handleInlineEdit(stock.id, 'purchasePrice', parseFloat(e.target.value), 'israeli')}
                                  onBlur={finishInlineEdit}
                                  onKeyPress={(e) => handleKeyPress(e, stock.id, 'purchasePrice', 'israeli')}
                                  autoFocus
                                  step="0.01"
                                />
                              ) : (
                                formatPrice(stock.purchasePrice)
                              )}
                            </td>
                            <td 
                              onClick={() => handleCellClick(stock.id, 'quantity', 'israeli')}
                              className={isEditMode ? 'editable-cell' : ''}
                            >
                              {editingField === `${stock.id}-quantity` ? (
                                <input
                                  type="number"
                                  value={stock.quantity}
                                  onChange={(e) => handleInlineEdit(stock.id, 'quantity', parseInt(e.target.value), 'israeli')}
                                  onBlur={finishInlineEdit}
                                  onKeyPress={(e) => handleKeyPress(e, stock.id, 'quantity', 'israeli')}
                                  autoFocus
                                  min="1"
                                />
                              ) : (
                                stock.quantity
                              )}
                            </td>
                            <td>{formatPrice(totalPurchase)}</td>
                            <td>{formatPrice(stock.currentPrice)}</td>
                            <td>{formatPrice(totalCurrentValue)}</td>
                            <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {formatPriceWithSign(profit)}
                            </td>
                            <td className="profit-negative">
                              {formatPriceWithSign(-capitalGainsTaxILS)}
                            </td>
                            <td className={afterTaxProfitILS >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {formatPriceWithSign(afterTaxProfitILS)}
                            </td>
                            <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {profitPercentage}%
                            </td>
                            <td className={(stock.dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {stock.dailyChangePercent !== undefined && stock.dailyChangePercent !== null ? stock.dailyChangePercent.toFixed(2) : '0.00'}%
                            </td>
                            <td className={(stock.dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {formatPriceWithSign(((stock.dailyChangePercent || 0) / 100) * totalCurrentValue)} ₪
                            </td>
                            {isEditMode && (
                              <td>
                                <button 
                                  onClick={() => handleDelete(stock.id, 'israeli')}
                                  className="delete-button"
                                >
                                  מחק
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      }
                      
                      // אם יש יותר ממנייה אחת, הצג כקיבוץ
                      return (
                        <React.Fragment key={stockName}>
                          {/* שורה מקובצת */}
                          <tr 
                            className={`${isEditMode ? 'editable-row' : ''} ${isExpanded ? 'summary-row-expanded' : ''}`}
                          >
                            <td 
                              onClick={() => handleCellClick(stocks[0].id, 'stockName', 'israeli')}
                              className={isEditMode ? 'editable-cell' : ''}
                            >
                              <button 
                                onClick={() => toggleGroup(stockName, 'israeli')}
                                className="expand-button"
                                style={{ marginRight: '8px', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                              {stockName}
                            </td>
                            <td>פתח קיבוץ</td>
                            <td>פתח קיבוץ</td>
                            <td>{summary.totalQuantity}</td>
                            <td>{formatPrice(summary.totalPurchaseValue)}</td>
                            <td>{formatPrice(summary.averageCurrentPrice)}</td>
                            <td>{formatPrice(summary.totalCurrentValue)}</td>
                            <td className={summary.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {formatPriceWithSign(summary.totalProfit)}
                            </td>
                            {(() => { const tax = summary.totalProfit > 0 ? summary.totalProfit * 0.25 : 0; const after = summary.totalProfit - tax; return (
                              <>
                                <td className="profit-negative">{formatPriceWithSign(-tax)}</td>
                                <td className={after >= 0 ? 'profit-positive' : 'profit-negative'}>{formatPriceWithSign(after)}</td>
                              </>
                            ); })()}
                            <td className={summary.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {summary.profitPercentage}%
                            </td>
                            <td className={(stocks[0].dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {stocks[0].dailyChangePercent !== undefined && stocks[0].dailyChangePercent !== null ? stocks[0].dailyChangePercent.toFixed(2) : '0.00'}%
                            </td>
                            <td className={(stocks[0].dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {formatPriceWithSign(((stocks[0].dailyChangePercent || 0) / 100) * summary.totalCurrentValue)} ₪
                            </td>
                            {isEditMode && <td></td>}
                          </tr>
                          
                          {/* שורות מפורטות */}
                          {isExpanded && stocks.map((stock) => {
                            const totalPurchase = (stock.purchasePrice || 0) * (stock.quantity || 0);
                            const totalCurrentValue = (stock.currentPrice || 0) * (stock.quantity || 0);
                            const profit = totalCurrentValue - totalPurchase;
                            const profitPercentage = calculateProfitPercentage(totalPurchase, totalCurrentValue);
                            const capitalGainsTaxILS = profit > 0 ? profit * 0.25 : 0;
                            const afterTaxProfitILS = profit - capitalGainsTaxILS;
                            
                            return (
                              <tr 
                                key={stock.id}
                                className={`${isEditMode ? 'editable-row' : ''} detail-row`}
                                style={{ backgroundColor: '#f8f9fa' }}
                              >
                                <td 
                                  onClick={() => handleCellClick(stock.id, 'stockName', 'israeli')}
                                  className={isEditMode ? 'editable-cell' : ''}
                                  style={{ paddingLeft: '20px' }}
                                >
                                  {editingField === `${stock.id}-stockName` ? (
                                    <input
                                      type="text"
                                      value={stock.stockName}
                                      onChange={(e) => handleInlineEdit(stock.id, 'stockName', e.target.value, 'israeli')}
                                      onBlur={finishInlineEdit}
                                      onKeyPress={(e) => handleKeyPress(e, stock.id, 'stockName', 'israeli')}
                                      autoFocus
                                    />
                                  ) : (
                                    stock.stockName
                                  )}
                                </td>
                                <td 
                                  onClick={() => handleCellClick(stock.id, 'purchaseDate', 'israeli')}
                                  className={isEditMode ? 'editable-cell' : ''}
                                >
                                  {editingField === `${stock.id}-purchaseDate` ? (
                                    <input
                                      type="date"
                                      value={stock.purchaseDate}
                                      onChange={(e) => handleInlineEdit(stock.id, 'purchaseDate', e.target.value, 'israeli')}
                                      onBlur={finishInlineEdit}
                                      onKeyPress={(e) => handleKeyPress(e, stock.id, 'purchaseDate', 'israeli')}
                                      autoFocus
                                    />
                                  ) : (
                                    formatDate(stock.purchaseDate)
                                  )}
                                </td>
                                <td 
                                  onClick={() => handleCellClick(stock.id, 'purchasePrice', 'israeli')}
                                  className={isEditMode ? 'editable-cell' : ''}
                                >
                                  {editingField === `${stock.id}-purchasePrice` ? (
                                    <input
                                      type="number"
                                      value={stock.purchasePrice}
                                      onChange={(e) => handleInlineEdit(stock.id, 'purchasePrice', parseFloat(e.target.value), 'israeli')}
                                      onBlur={finishInlineEdit}
                                      onKeyPress={(e) => handleKeyPress(e, stock.id, 'purchasePrice', 'israeli')}
                                      autoFocus
                                      step="0.01"
                                    />
                                  ) : (
                                    formatPrice(stock.purchasePrice)
                                  )}
                                </td>
                                <td 
                                  onClick={() => handleCellClick(stock.id, 'quantity', 'israeli')}
                                  className={isEditMode ? 'editable-cell' : ''}
                                >
                                  {editingField === `${stock.id}-quantity` ? (
                                    <input
                                      type="number"
                                      value={stock.quantity}
                                      onChange={(e) => handleInlineEdit(stock.id, 'quantity', parseInt(e.target.value), 'israeli')}
                                      onBlur={finishInlineEdit}
                                      onKeyPress={(e) => handleKeyPress(e, stock.id, 'quantity', 'israeli')}
                                      autoFocus
                                      min="1"
                                    />
                                  ) : (
                                    stock.quantity
                                  )}
                                </td>
                                <td>{formatPrice(totalPurchase)}</td>
                                <td>{formatPrice(stock.currentPrice)}</td>
                                <td>{formatPrice(totalCurrentValue)}</td>
                                <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                                  {formatPriceWithSign(profit)}
                                </td>
                                <td className="profit-negative">
                                  {formatPriceWithSign(-capitalGainsTaxILS)}
                                </td>
                                <td className={afterTaxProfitILS >= 0 ? 'profit-positive' : 'profit-negative'}>
                                  {formatPriceWithSign(afterTaxProfitILS)}
                                </td>
                                <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                                  {profitPercentage}%
                                </td>
                                <td className={(stock.dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                                  {stock.dailyChangePercent !== undefined && stock.dailyChangePercent !== null ? stock.dailyChangePercent.toFixed(2) : '0.00'}%
                                </td>
                                <td className={(stock.dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                                  {formatPriceWithSign(((stock.dailyChangePercent || 0) / 100) * totalCurrentValue)} ₪
                                </td>
                                {isEditMode && (
                                  <td>
                                    <button 
                                      onClick={() => handleDelete(stock.id, 'israeli')}
                                      className="delete-button"
                                    >
                                      מחק
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* טבלת בורסה אמריקאית */}
          {americanStocks.length > 0 && (
            <div className="stocks-section">
              <h2 className="section-title">בורסה אמריקאית</h2>
              <div className="table-container">
                <table className="stocks-table american-stocks-table">
                  <thead>
                    <tr>
                      <th>שם מנייה</th>
                      {showAmericanColumns && <th>תאריך קנייה</th>}
                      {showAmericanColumns && <th>מחיר קנייה</th>}
                      {showAmericanColumns && <th>כמות</th>}
                      <th>סה"כ רכישה בדולר</th>
                      {showAmericanColumns && <th>סה"כ רכישה בשקל</th>}
                      {showAmericanColumns && <th>שער חליפין ביום הקנייה</th>}
                      {showAmericanColumns && <th>שער חליפין היום</th>}
                      <th>מחיר נוכחי</th>
                      <th>סה"כ שווי בדולר</th>
                      {showAmericanColumns && <th>סה"כ שווי בש"ח</th>}
                      <th>סה"כ רווח/הפסד ($)</th>
                      {showAmericanColumns && <th>סה"כ רווח/הפסד (₪)</th>}
                      <th>אחוז רווח/הפסד</th>
                      <th>אחוז שינוי יומי</th>
                      <th>רווח/הפסד יומי בדולר</th>
                      {showAmericanColumns && <th>השפעת שער חליפין</th>}
                      {showAmericanColumns && <th>מס רווח הון ($)</th>}
                      {showAmericanColumns && <th>מס רווח הון (₪)</th>}
                      {showAmericanColumns && <th>רווח לאחר מס ($)</th>}
                      {showAmericanColumns && <th>רווח לאחר מס (₪)</th>}
                      {isEditMode && <th>פעולות</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupStocksByName(americanStocks)).map(([stockName, stocks]) => {
                      const isExpanded = expandedGroups[`american-${stockName}`];
                      const summary = calculateGroupSummary(stocks);
                      
                      // אם יש רק מנייה אחת, הצג אותה כרגיל ללא קיבוץ
                      if (stocks.length === 1) {
                        const stock = stocks[0];
                        const totalPurchaseUSD = (stock.purchasePrice || 0) * (stock.quantity || 0);
                        const totalPurchaseILS = totalPurchaseUSD * (stock.exchangeRate || 0);
                        const totalCurrentValueUSD = (stock.currentPrice || 0) * (stock.quantity || 0);
                        const currentExchangeRate = stock.currentExchangeRate || stock.exchangeRate || 0;
                        const totalCurrentValueILS = totalCurrentValueUSD * currentExchangeRate;
                        const profitPercentage = calculateProfitPercentage(stock.purchasePrice || 0, stock.currentPrice || 0);
                        
                        // חישוב השפעת שער החליפין - ההפרש בין הרווח בשער הקנייה לרווח בשער הנוכחי
                        const profitUSD = totalCurrentValueUSD - totalPurchaseUSD;
                        const profitILS = profitUSD * currentExchangeRate;
                        const taxUSD = profitUSD > 0 ? profitUSD * 0.25 : 0;
                        const taxILS = taxUSD * currentExchangeRate;
                        const afterTaxUSD = profitUSD - taxUSD;
                        const afterTaxILS = profitILS - taxILS;
                        const profitAtPurchaseRate = profitUSD * stock.exchangeRate;
                        const exchangeRateImpact = profitILS - profitAtPurchaseRate;
                        
                        return (
                          <tr 
                            key={stock.id}
                            className={isEditMode ? 'editable-row' : ''}
                          >
                            <td 
                              onClick={() => handleCellClick(stock.id, 'stockName', 'american')}
                              className={isEditMode ? 'editable-cell' : ''}
                            >
                              {editingField === `${stock.id}-stockName` ? (
                                <input
                                  type="text"
                                  value={stock.stockName}
                                  onChange={(e) => handleInlineEdit(stock.id, 'stockName', e.target.value, 'american')}
                                  onBlur={finishInlineEdit}
                                  onKeyPress={(e) => handleKeyPress(e, stock.id, 'stockName', 'american')}
                                  autoFocus
                                />
                              ) : (
                                stock.stockName
                              )}
                            </td>
                            {showAmericanColumns && (
                              <td 
                                onClick={() => handleCellClick(stock.id, 'purchaseDate', 'american')}
                                className={isEditMode ? 'editable-cell' : ''}
                              >
                                {editingField === `${stock.id}-purchaseDate` ? (
                                  <input
                                    type="date"
                                    value={stock.purchaseDate}
                                    onChange={(e) => handleInlineEdit(stock.id, 'purchaseDate', e.target.value, 'american')}
                                    onBlur={finishInlineEdit}
                                    onKeyPress={(e) => handleKeyPress(e, stock.id, 'purchaseDate', 'american')}
                                    autoFocus
                                  />
                                ) : (
                                  formatDate(stock.purchaseDate)
                                )}
                              </td>
                            )}
                            {showAmericanColumns && (
                              <td 
                                onClick={() => handleCellClick(stock.id, 'purchasePrice', 'american')}
                                className={isEditMode ? 'editable-cell' : ''}
                              >
                                {editingField === `${stock.id}-purchasePrice` ? (
                                  <input
                                    type="number"
                                    value={stock.purchasePrice}
                                    onChange={(e) => handleInlineEdit(stock.id, 'purchasePrice', parseFloat(e.target.value), 'american')}
                                    onBlur={finishInlineEdit}
                                    onKeyPress={(e) => handleKeyPress(e, stock.id, 'purchasePrice', 'american')}
                                    autoFocus
                                    step="0.01"
                                  />
                                ) : (
                                  formatPriceWithSign(stock.purchasePrice) + ' $'
                                )}
                              </td>
                            )}
                            {showAmericanColumns && (
                              <td 
                                onClick={() => handleCellClick(stock.id, 'quantity', 'american')}
                                className={isEditMode ? 'editable-cell' : ''}
                              >
                                {editingField === `${stock.id}-quantity` ? (
                                  <input
                                    type="number"
                                    value={stock.quantity}
                                    onChange={(e) => handleInlineEdit(stock.id, 'quantity', parseInt(e.target.value), 'american')}
                                    onBlur={finishInlineEdit}
                                    onKeyPress={(e) => handleKeyPress(e, stock.id, 'quantity', 'american')}
                                    autoFocus
                                    min="1"
                                  />
                                ) : (
                                  stock.quantity
                                )}
                              </td>
                            )}
                            <td>{formatPriceWithSign(totalPurchaseUSD)} $</td>
                            {showAmericanColumns && <td>{formatPriceWithSign(totalPurchaseILS)} ₪</td>}
                            {showAmericanColumns && (
                              <td 
                                onClick={() => handleCellClick(stock.id, 'exchangeRate', 'american')}
                                className={isEditMode ? 'editable-cell' : ''}
                              >
                                {editingField === `${stock.id}-exchangeRate` ? (
                                  <input
                                    type="number"
                                    value={stock.exchangeRate}
                                    onChange={(e) => handleInlineEdit(stock.id, 'exchangeRate', parseFloat(e.target.value), 'american')}
                                    onBlur={finishInlineEdit}
                                    onKeyPress={(e) => handleKeyPress(e, stock.id, 'exchangeRate', 'american')}
                                    autoFocus
                                    step="0.0001"
                                  />
                                ) : (
                                  formatPrice(stock.exchangeRate)
                                )}
                              </td>
                            )}
                            {showAmericanColumns && <td>{formatPrice(currentExchangeRate)}</td>}
                            <td>{formatPriceWithSign(stock.currentPrice)} $</td>
                            <td>{formatPriceWithSign(totalCurrentValueUSD)} $</td>
                            {showAmericanColumns && <td>{formatPriceWithSign(totalCurrentValueILS)} ₪</td>}
                            <td className={profitUSD >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {formatPriceWithSign(profitUSD)} $
                            </td>
                            {showAmericanColumns && (
                              <td className={profitILS >= 0 ? 'profit-positive' : 'profit-negative'}>
                                {formatPriceWithSign(profitILS)} ₪
                              </td>
                            )}
                            <td className={profitPercentage >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {profitPercentage}%
                            </td>
                            <td className={(stock.dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {stock.dailyChangePercent ? stock.dailyChangePercent.toFixed(2) : '0.00'}%
                            </td>
                            <td className={(stock.dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {formatPriceWithSign(((stock.dailyChangePercent || 0) / 100) * totalCurrentValueUSD)} $
                            </td>
                            {showAmericanColumns && (
                              <td className={exchangeRateImpact >= 0 ? 'profit-positive' : 'profit-negative'}>
                                {formatPriceWithSign(exchangeRateImpact)} ₪
                              </td>
                            )}
                            {showAmericanColumns && (
                              <td className="profit-negative">
                                {formatPriceWithSign(-taxUSD)} $
                              </td>
                            )}
                            {showAmericanColumns && (
                              <td className="profit-negative">
                                {formatPriceWithSign(-taxILS)} ₪
                              </td>
                            )}
                            {showAmericanColumns && (
                              <td className={afterTaxUSD >= 0 ? 'profit-positive' : 'profit-negative'}>
                                {formatPriceWithSign(afterTaxUSD)} $
                              </td>
                            )}
                            {showAmericanColumns && (
                              <td className={afterTaxILS >= 0 ? 'profit-positive' : 'profit-negative'}>
                                {formatPriceWithSign(afterTaxILS)} ₪
                              </td>
                            )}
                            {isEditMode && (
                              <td>
                                <button 
                                  onClick={() => handleDelete(stock.id, 'american')}
                                  className="delete-button"
                                >
                                  מחק
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      }
                      
                      // חישוב סיכומים למניות אמריקאיות
                      const totalPurchaseUSD = stocks.reduce((sum, stock) => sum + ((stock.purchasePrice || 0) * (stock.quantity || 0)), 0);
                      const totalPurchaseILS = stocks.reduce((sum, stock) => sum + ((stock.purchasePrice || 0) * (stock.quantity || 0) * (stock.exchangeRate || 0)), 0);
                      const totalCurrentValueUSD = stocks.reduce((sum, stock) => sum + ((stock.currentPrice || 0) * (stock.quantity || 0)), 0);
                      const totalCurrentValueILS = stocks.reduce((sum, stock) => {
                        const currentExchangeRate = stock.currentExchangeRate || stock.exchangeRate || 0;
                        return sum + ((stock.currentPrice || 0) * (stock.quantity || 0) * currentExchangeRate);
                      }, 0);
                      // חישוב מחיר ממוצע משוקלל למחיר קנייה ומחיר נוכחי
                      const averagePurchasePrice = summary.totalQuantity > 0 ? totalPurchaseUSD / summary.totalQuantity : 0;
                      const averageCurrentPrice = summary.totalQuantity > 0 ? totalCurrentValueUSD / summary.totalQuantity : 0;
                      const profitPercentage = calculateProfitPercentage(averagePurchasePrice, averageCurrentPrice);
                      
                      // חישוב רווח כולל עבור הקיבוץ
                      const totalProfitUSD = totalCurrentValueUSD - totalPurchaseUSD;
                      const totalProfitILS = totalProfitUSD * (stocks[0].currentExchangeRate || stocks[0].exchangeRate || 0);
                      const totalTaxUSD = totalProfitUSD > 0 ? totalProfitUSD * 0.25 : 0;
                      const totalTaxILS = totalTaxUSD * (stocks[0].currentExchangeRate || stocks[0].exchangeRate || 0);
                      const totalAfterTaxUSD = totalProfitUSD - totalTaxUSD;
                      const totalAfterTaxILS = totalProfitILS - totalTaxILS;
                      
                      // חישוב השפעת שער החליפין הכוללת עבור הקיבוץ
                      const totalExchangeRateImpact = stocks.reduce((sum, stock) => {
                        const stockPurchaseUSD = (stock.purchasePrice || 0) * (stock.quantity || 0);
                        const stockCurrentValueUSD = (stock.currentPrice || 0) * (stock.quantity || 0);
                        const stockProfitUSD = stockCurrentValueUSD - stockPurchaseUSD;
                        const stockProfitILS = stockProfitUSD * (stock.currentExchangeRate || stock.exchangeRate || 0);
                        const stockProfitAtPurchaseRate = stockProfitUSD * (stock.exchangeRate || 0);
                        return sum + (stockProfitILS - stockProfitAtPurchaseRate);
                      }, 0);
                      
                      // חישוב מחיר ממוצע משוקלל
                      const averageCurrentPriceUSD = summary.totalQuantity > 0 ? totalCurrentValueUSD / summary.totalQuantity : 0;
                      
                      // אם יש יותר ממנייה אחת, הצג כקיבוץ
                      return (
                        <React.Fragment key={stockName}>
                          {/* שורה מקובצת */}
                          <tr 
                            className={`${isEditMode ? 'editable-row' : ''} ${isExpanded ? 'summary-row-expanded' : ''}`}
                          >
                            <td 
                              onClick={() => handleCellClick(stocks[0].id, 'stockName', 'american')}
                              className={isEditMode ? 'editable-cell' : ''}
                            >
                              <button 
                                onClick={() => toggleGroup(stockName, 'american')}
                                className="expand-button"
                                style={{ marginRight: '8px', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                              {stockName}
                            </td>
                            {showAmericanColumns && <td>{isExpanded ? '' : 'פתח קיבוץ'}</td>}
                            {showAmericanColumns && <td>{isExpanded ? '' : 'פתח קיבוץ'}</td>}
                            {showAmericanColumns && <td>{summary.totalQuantity}</td>}
                            <td>{formatPriceWithSign(totalPurchaseUSD)} $</td>
                            {showAmericanColumns && <td>{formatPriceWithSign(totalPurchaseILS)} ₪</td>}
                            {showAmericanColumns && <td>{isExpanded ? '' : 'פתח קיבוץ'}</td>}
                            {showAmericanColumns && <td>{formatPrice(stocks[0].currentExchangeRate || stocks[0].exchangeRate || 0)}</td>}
                            <td>{formatPriceWithSign(averageCurrentPriceUSD)} $</td>
                            <td>{formatPriceWithSign(totalCurrentValueUSD)} $</td>
                            {showAmericanColumns && <td>{formatPriceWithSign(totalCurrentValueILS)} ₪</td>}
                            <td className={totalProfitUSD >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {formatPriceWithSign(totalProfitUSD)} $
                            </td>
                            {showAmericanColumns && (
                              <td className={totalProfitILS >= 0 ? 'profit-positive' : 'profit-negative'}>
                                {formatPriceWithSign(totalProfitILS)} ₪
                              </td>
                            )}
                            <td className={profitPercentage >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {profitPercentage}%
                            </td>
                            <td className={(stocks[0].dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {stocks[0].dailyChangePercent ? stocks[0].dailyChangePercent.toFixed(2) : '0.00'}%
                            </td>
                            <td className={(stocks[0].dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {formatPriceWithSign(((stocks[0].dailyChangePercent || 0) / 100) * totalCurrentValueUSD)} $
                            </td>
                            {showAmericanColumns && (
                              <td className={totalExchangeRateImpact >= 0 ? 'profit-positive' : 'profit-negative'}>
                                {formatPriceWithSign(totalExchangeRateImpact)} ₪
                              </td>
                            )}
                            {showAmericanColumns && (
                              <td className="profit-negative">
                                {formatPriceWithSign(-totalTaxUSD)} $
                              </td>
                            )}
                            {showAmericanColumns && (
                              <td className="profit-negative">
                                {formatPriceWithSign(-totalTaxILS)} ₪
                              </td>
                            )}
                            {showAmericanColumns && (
                              <td className={totalAfterTaxUSD >= 0 ? 'profit-positive' : 'profit-negative'}>
                                {formatPriceWithSign(totalAfterTaxUSD)} $
                              </td>
                            )}
                            {showAmericanColumns && (
                              <td className={totalAfterTaxILS >= 0 ? 'profit-positive' : 'profit-negative'}>
                                {formatPriceWithSign(totalAfterTaxILS)} ₪
                              </td>
                            )}
                            {isEditMode && <td></td>}
                          </tr>
                          
                          {/* שורות מפורטות */}
                          {isExpanded && stocks.map((stock) => {
                            const totalPurchaseUSD = (stock.purchasePrice || 0) * (stock.quantity || 0);
                            const totalPurchaseILS = totalPurchaseUSD * (stock.exchangeRate || 0);
                            const totalCurrentValueUSD = (stock.currentPrice || 0) * (stock.quantity || 0);
                            const currentExchangeRate = stock.currentExchangeRate || stock.exchangeRate || 0;
                            const totalCurrentValueILS = totalCurrentValueUSD * currentExchangeRate;
                            const profitPercentage = calculateProfitPercentage(stock.purchasePrice || 0, stock.currentPrice || 0);
                            
                            // חישוב השפעת שער החליפין - ההפרש בין הרווח בשער הקנייה לרווח בשער הנוכחי
                            const profitUSD = totalCurrentValueUSD - totalPurchaseUSD;
                            const profitILS = profitUSD * currentExchangeRate;
                            const taxUSD = profitUSD > 0 ? profitUSD * 0.25 : 0;
                            const taxILS = taxUSD * currentExchangeRate;
                            const afterTaxUSD = profitUSD - taxUSD;
                            const afterTaxILS = profitILS - taxILS;
                            const profitAtPurchaseRate = profitUSD * stock.exchangeRate;
                            const exchangeRateImpact = profitILS - profitAtPurchaseRate;
                            
                            return (
                              <tr 
                                key={stock.id}
                                className={`${isEditMode ? 'editable-row' : ''} detail-row`}
                                style={{ backgroundColor: '#f8f9fa' }}
                              >
                                <td 
                                  onClick={() => handleCellClick(stock.id, 'stockName', 'american')}
                                  className={isEditMode ? 'editable-cell' : ''}
                                  style={{ paddingLeft: '20px' }}
                                >
                                  {editingField === `${stock.id}-stockName` ? (
                                    <input
                                      type="text"
                                      value={stock.stockName}
                                      onChange={(e) => handleInlineEdit(stock.id, 'stockName', e.target.value, 'american')}
                                      onBlur={finishInlineEdit}
                                      onKeyPress={(e) => handleKeyPress(e, stock.id, 'stockName', 'american')}
                                      autoFocus
                                    />
                                  ) : (
                                    stock.stockName
                                  )}
                                </td>
                                {showAmericanColumns && (
                                  <td 
                                    onClick={() => handleCellClick(stock.id, 'purchaseDate', 'american')}
                                    className={isEditMode ? 'editable-cell' : ''}
                                  >
                                    {editingField === `${stock.id}-purchaseDate` ? (
                                      <input
                                        type="date"
                                        value={stock.purchaseDate}
                                        onChange={(e) => handleInlineEdit(stock.id, 'purchaseDate', e.target.value, 'american')}
                                        onBlur={finishInlineEdit}
                                        onKeyPress={(e) => handleKeyPress(e, stock.id, 'purchaseDate', 'american')}
                                        autoFocus
                                      />
                                    ) : (
                                      formatDate(stock.purchaseDate)
                                    )}
                                  </td>
                                )}
                                {showAmericanColumns && (
                                  <td 
                                    onClick={() => handleCellClick(stock.id, 'purchasePrice', 'american')}
                                    className={isEditMode ? 'editable-cell' : ''}
                                  >
                                    {editingField === `${stock.id}-purchasePrice` ? (
                                      <input
                                        type="number"
                                        value={stock.purchasePrice}
                                        onChange={(e) => handleInlineEdit(stock.id, 'purchasePrice', parseFloat(e.target.value), 'american')}
                                        onBlur={finishInlineEdit}
                                        onKeyPress={(e) => handleKeyPress(e, stock.id, 'purchasePrice', 'american')}
                                        autoFocus
                                        step="0.01"
                                      />
                                    ) : (
                                      formatPriceWithSign(stock.purchasePrice) + ' $'
                                    )}
                                  </td>
                                )}
                                {showAmericanColumns && (
                                  <td 
                                    onClick={() => handleCellClick(stock.id, 'quantity', 'american')}
                                    className={isEditMode ? 'editable-cell' : ''}
                                  >
                                    {editingField === `${stock.id}-quantity` ? (
                                      <input
                                        type="number"
                                        value={stock.quantity}
                                        onChange={(e) => handleInlineEdit(stock.id, 'quantity', parseInt(e.target.value), 'american')}
                                        onBlur={finishInlineEdit}
                                        onKeyPress={(e) => handleKeyPress(e, stock.id, 'quantity', 'american')}
                                        autoFocus
                                        min="1"
                                      />
                                    ) : (
                                      stock.quantity
                                    )}
                                  </td>
                                )}
                                <td>{formatPriceWithSign(totalPurchaseUSD)} $</td>
                                {showAmericanColumns && <td>{formatPriceWithSign(totalPurchaseILS)} ₪</td>}
                                {showAmericanColumns && (
                                  <td 
                                    onClick={() => handleCellClick(stock.id, 'exchangeRate', 'american')}
                                    className={isEditMode ? 'editable-cell' : ''}
                                  >
                                    {editingField === `${stock.id}-exchangeRate` ? (
                                      <input
                                        type="number"
                                        value={stock.exchangeRate}
                                        onChange={(e) => handleInlineEdit(stock.id, 'exchangeRate', parseFloat(e.target.value), 'american')}
                                        onBlur={finishInlineEdit}
                                        onKeyPress={(e) => handleKeyPress(e, stock.id, 'exchangeRate', 'american')}
                                        autoFocus
                                        step="0.0001"
                                      />
                                    ) : (
                                      formatPrice(stock.exchangeRate)
                                    )}
                                  </td>
                                )}
                                {showAmericanColumns && <td>{formatPrice(currentExchangeRate)}</td>}
                                <td>{formatPriceWithSign(stock.currentPrice)} $</td>
                                <td>{formatPriceWithSign(totalCurrentValueUSD)} $</td>
                                {showAmericanColumns && <td>{formatPriceWithSign(totalCurrentValueILS)} ₪</td>}
                                <td className={profitUSD >= 0 ? 'profit-positive' : 'profit-negative'}>
                                  {formatPriceWithSign(profitUSD)} $
                                </td>
                                {showAmericanColumns && (
                                  <td className={profitILS >= 0 ? 'profit-positive' : 'profit-negative'}>
                                    {formatPriceWithSign(profitILS)} ₪
                                  </td>
                                )}
                                <td className={profitPercentage >= 0 ? 'profit-positive' : 'profit-negative'}>
                                  {profitPercentage}%
                                </td>
                                <td className={(stock.dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                                  {stock.dailyChangePercent ? stock.dailyChangePercent.toFixed(2) : '0.00'}%
                                </td>
                                <td className={(stock.dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                                  {formatPriceWithSign(((stock.dailyChangePercent || 0) / 100) * totalCurrentValueUSD)} $
                                </td>
                                {showAmericanColumns && (
                                  <td className={exchangeRateImpact >= 0 ? 'profit-positive' : 'profit-negative'}>
                                    {formatPriceWithSign(exchangeRateImpact)} ₪
                                  </td>
                                )}
                                {showAmericanColumns && (
                                  <td className="profit-negative">
                                    {formatPriceWithSign(-taxUSD)} $
                                  </td>
                                )}
                                {showAmericanColumns && (
                                  <td className="profit-negative">
                                    {formatPriceWithSign(-taxILS)} ₪
                                  </td>
                                )}
                                {showAmericanColumns && (
                                  <td className={afterTaxUSD >= 0 ? 'profit-positive' : 'profit-negative'}>
                                    {formatPriceWithSign(afterTaxUSD)} $
                                  </td>
                                )}
                                {showAmericanColumns && (
                                  <td className={afterTaxILS >= 0 ? 'profit-positive' : 'profit-negative'}>
                                    {formatPriceWithSign(afterTaxILS)} ₪
                                  </td>
                                )}
                                {isEditMode && (
                                  <td>
                                    <button 
                                      onClick={() => handleDelete(stock.id, 'american')}
                                      className="delete-button"
                                    >
                                      מחק
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* טבלת קופות גמל */}
          {pensionFunds.length > 0 && (
            <div className="stocks-section">
              <h2 className="section-title">קופות גמל</h2>
              <div className="table-container">
                <table className="stocks-table">
                  <thead>
                    <tr>
                      <th>שם קופה</th>
                      <th>תאריך עדכון</th>
                      <th>סכום בקופה (₪)</th>
                      {isEditMode && <th>פעולות</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {pensionFunds.map(item => (
                      <tr key={item.id} className={isEditMode ? 'editable-row' : ''}>
                        <td
                          onClick={() => handleCellClick(item.id, 'fundName', 'pension')}
                          className={isEditMode ? 'editable-cell' : ''}
                        >
                          {editingField === `${item.id}-fundName` ? (
                            <input
                              type="text"
                              value={item.fundName}
                              onChange={(e) => handleInlineEdit(item.id, 'fundName', e.target.value, 'pension')}
                              onBlur={finishInlineEdit}
                              onKeyPress={(e) => handleKeyPress(e, item.id, 'fundName', 'pension')}
                              autoFocus
                            />
                          ) : (
                            item.fundName
                          )}
                        </td>
                        <td
                          onClick={() => handleCellClick(item.id, 'updateDate', 'pension')}
                          className={isEditMode ? 'editable-cell' : ''}
                        >
                          {editingField === `${item.id}-updateDate` ? (
                            <input
                              type="date"
                              value={item.updateDate}
                              onChange={(e) => handleInlineEdit(item.id, 'updateDate', e.target.value, 'pension')}
                              onBlur={finishInlineEdit}
                              onKeyPress={(e) => handleKeyPress(e, item.id, 'updateDate', 'pension')}
                              autoFocus
                            />
                          ) : (
                            formatDate(item.updateDate)
                          )}
                        </td>
                        <td
                          onClick={() => handleCellClick(item.id, 'amount', 'pension')}
                          className={isEditMode ? 'editable-cell' : ''}
                        >
                          {editingField === `${item.id}-amount` ? (
                            <input
                              type="number"
                              value={item.amount}
                              onChange={(e) => handleInlineEdit(item.id, 'amount', parseFloat(e.target.value), 'pension')}
                              onBlur={finishInlineEdit}
                              onKeyPress={(e) => handleKeyPress(e, item.id, 'amount', 'pension')}
                              autoFocus
                              step="0.01"
                              min="0"
                            />
                          ) : (
                            `${formatPriceWithSign(item.amount)} ₪`
                          )}
                        </td>
                        {isEditMode && (
                          <td>
                            <button 
                              onClick={() => handleDelete(item.id, 'pension')}
                              className="delete-button"
                            >
                              מחק
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* טבלת כספית שקלית */}
          {cashFunds.length > 0 && (
            <div className="stocks-section">
              <h2 className="section-title">כספית שקלית</h2>
              <div className="table-container">
                <table className="stocks-table">
                  <thead>
                    <tr>
                      <th>שם</th>
                      <th>מספר נייר ערך</th>
                      <th>תאריך עדכון</th>
                      <th>סכום (₪)</th>
                      {isEditMode && <th>פעולות</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {cashFunds.map(item => (
                      <tr key={item.id} className={isEditMode ? 'editable-row' : ''}>
                        <td
                          onClick={() => handleCellClick(item.id, 'fundName', 'cash_fund')}
                          className={isEditMode ? 'editable-cell' : ''}
                        >
                          {editingField === `${item.id}-fundName` ? (
                            <input
                              type="text"
                              value={item.fundName}
                              onChange={(e) => handleInlineEdit(item.id, 'fundName', e.target.value, 'cash_fund')}
                              onBlur={finishInlineEdit}
                              onKeyPress={(e) => handleKeyPress(e, item.id, 'fundName', 'cash_fund')}
                              autoFocus
                            />
                          ) : (
                            item.fundName
                          )}
                        </td>
                        <td
                          onClick={() => handleCellClick(item.id, 'securityId', 'cash_fund')}
                          className={isEditMode ? 'editable-cell' : ''}
                        >
                          {editingField === `${item.id}-securityId` ? (
                            <input
                              type="text"
                              value={item.securityId}
                              onChange={(e) => handleInlineEdit(item.id, 'securityId', e.target.value, 'cash_fund')}
                              onBlur={finishInlineEdit}
                              onKeyPress={(e) => handleKeyPress(e, item.id, 'securityId', 'cash_fund')}
                              autoFocus
                            />
                          ) : (
                            item.securityId
                          )}
                        </td>
                        <td
                          onClick={() => handleCellClick(item.id, 'updateDate', 'cash_fund')}
                          className={isEditMode ? 'editable-cell' : ''}
                        >
                          {editingField === `${item.id}-updateDate` ? (
                            <input
                              type="date"
                              value={item.updateDate}
                              onChange={(e) => handleInlineEdit(item.id, 'updateDate', e.target.value, 'cash_fund')}
                              onBlur={finishInlineEdit}
                              onKeyPress={(e) => handleKeyPress(e, item.id, 'updateDate', 'cash_fund')}
                              autoFocus
                            />
                          ) : (
                            formatDate(item.updateDate)
                          )}
                        </td>
                        <td
                          onClick={() => handleCellClick(item.id, 'amount', 'cash_fund')}
                          className={isEditMode ? 'editable-cell' : ''}
                        >
                          {editingField === `${item.id}-amount` ? (
                            <input
                              type="number"
                              value={item.amount}
                              onChange={(e) => handleInlineEdit(item.id, 'amount', parseFloat(e.target.value), 'cash_fund')}
                              onBlur={finishInlineEdit}
                              onKeyPress={(e) => handleKeyPress(e, item.id, 'amount', 'cash_fund')}
                              autoFocus
                              step="0.01"
                              min="0"
                            />
                          ) : (
                            `${formatPriceWithSign(item.amount)} ₪`
                          )}
                        </td>
                        {isEditMode && (
                          <td>
                            <button 
                              onClick={() => handleDelete(item.id, 'cash_fund')}
                              className="delete-button"
                            >
                              מחק
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* טבלת עו"ש */}
          {bankBalances.length > 0 && (
            <div className="stocks-section">
              <h2 className="section-title">עו"ש</h2>
              <div className="table-container">
                <table className="stocks-table">
                  <thead>
                    <tr>
                      <th>תאריך עדכון</th>
                      <th>סכום (₪)</th>
                      {isEditMode && <th>פעולות</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {bankBalances.map(item => (
                      <tr key={item.id} className={isEditMode ? 'editable-row' : ''}>
                        <td
                          onClick={() => handleCellClick(item.id, 'updateDate', 'bank')}
                          className={isEditMode ? 'editable-cell' : ''}
                        >
                          {editingField === `${item.id}-updateDate` ? (
                            <input
                              type="date"
                              value={item.updateDate}
                              onChange={(e) => handleInlineEdit(item.id, 'updateDate', e.target.value, 'bank')}
                              onBlur={finishInlineEdit}
                              onKeyPress={(e) => handleKeyPress(e, item.id, 'updateDate', 'bank')}
                              autoFocus
                            />
                          ) : (
                            formatDate(item.updateDate)
                          )}
                        </td>
                        <td
                          onClick={() => handleCellClick(item.id, 'amount', 'bank')}
                          className={isEditMode ? 'editable-cell' : ''}
                        >
                          {editingField === `${item.id}-amount` ? (
                            <input
                              type="number"
                              value={item.amount}
                              onChange={(e) => handleInlineEdit(item.id, 'amount', parseFloat(e.target.value), 'bank')}
                              onBlur={finishInlineEdit}
                              onKeyPress={(e) => handleKeyPress(e, item.id, 'amount', 'bank')}
                              autoFocus
                              step="0.01"
                              min="0"
                            />
                          ) : (
                            `${formatPriceWithSign(item.amount)} ₪`
                          )}
                        </td>
                        {isEditMode && (
                          <td>
                            <button 
                              onClick={() => handleDelete(item.id, 'bank')}
                              className="delete-button"
                            >
                              מחק
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* הודעה אם אין נתונים */}
          {israeliStocks.length === 0 && americanStocks.length === 0 && (
            <div className="no-data-message">
              <p>עדיין לא נוספו מניות לתיק ההשקעות שלך</p>
              <p>לחץ על הכפתור למעלה כדי להתחיל</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;