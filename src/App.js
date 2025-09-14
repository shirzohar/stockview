import './App.css';
import React, { useState, useEffect } from 'react';

function App() {
  const [showForm, setShowForm] = useState(false);
  const [israeliStocks, setIsraeliStocks] = useState([]);
  const [americanStocks, setAmericanStocks] = useState([]);
  const [formData, setFormData] = useState({
    stockName: '',
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
    
    if (savedIsraeliStocks) {
      setIsraeliStocks(JSON.parse(savedIsraeliStocks));
    }
    
    if (savedAmericanStocks) {
      setAmericanStocks(JSON.parse(savedAmericanStocks));
    }
  }, []);

  // עדכון אוטומטי של מחירי מניות כל 10 שניות
  useEffect(() => {
    const interval = setInterval(async () => {
      // עדכון מניות ישראליות
      if (israeliStocks.length > 0) {
        const updatedIsraeliStocks = [];
        for (const stock of israeliStocks) {
          // מנייה ישראלית - לא מעדכנים מחיר
          updatedIsraeliStocks.push(stock);
        }
        setIsraeliStocks(updatedIsraeliStocks);
      }

      // עדכון מניות אמריקאיות
      if (americanStocks.length > 0) {
        console.log(`🔄 מעדכן מניות אמריקאיות (${americanStocks.length} מניות)`);
        // קבלת שער החליפין הנוכחי
        const currentExchangeRate = await fetchExchangeRate();
        
        const updatedAmericanStocks = [];
        for (const stock of americanStocks) {
          try {
            const priceData = await fetchCurrentPrice(stock.stockName);
            if (priceData !== null) {
              updatedAmericanStocks.push({
                ...stock, 
                currentPrice: priceData.currentPrice,
                dailyChangePercent: priceData.changePercent,
                currentExchangeRate: currentExchangeRate || stock.currentExchangeRate || stock.exchangeRate
              });
            } else {
              updatedAmericanStocks.push({
                ...stock,
                currentExchangeRate: currentExchangeRate || stock.currentExchangeRate || stock.exchangeRate
              });
            }
          } catch (error) {
            updatedAmericanStocks.push({
              ...stock,
              currentExchangeRate: currentExchangeRate || stock.currentExchangeRate || stock.exchangeRate
            });
          }
        }
        setAmericanStocks(updatedAmericanStocks);
        saveToLocalStorage(israeliStocks, updatedAmericanStocks);
      }
    }, 10000); // 10 שניות

    return () => clearInterval(interval);
  }, [israeliStocks.length, americanStocks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // שמירת נתונים ב-LocalStorage
  const saveToLocalStorage = (israeliData, americanData) => {
    localStorage.setItem('israeliStocks', JSON.stringify(israeliData));
    localStorage.setItem('americanStocks', JSON.stringify(americanData));
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
      console.error('Error fetching price:', error);
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
      console.error('Error fetching exchange rate:', error);
      return null;
    }
  };




  const handleAddInfo = () => {
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
    
    // קבלת מחיר נוכחי ואחוז שינוי יומי מ-API
    let currentPrice = 0;
    let dailyChangePercent = 0;
    
    if (formData.exchange === 'american') {
      console.log(`🇺🇸 מוסיף מנייה אמריקאית: ${formData.stockName}`);
      const priceData = await fetchCurrentPrice(formData.stockName.trim());
      if (priceData) {
        currentPrice = priceData.currentPrice || 0;
        dailyChangePercent = priceData.changePercent || 0;
      }
    } else if (formData.exchange === 'israeli') {
      // מנייה ישראלית - לא מעדכנים מחיר
      currentPrice = 0;
      dailyChangePercent = 0;
    }
    
    // יצירת אובייקט עם הנתונים
    const stockData = {
      id: Date.now(), // מזהה ייחודי
      stockName: formData.stockName,
      purchaseDate: formData.purchaseDate,
      purchasePrice: parseFloat(formData.purchasePrice),
      quantity: parseInt(formData.quantity),
      exchangeRate: formData.exchange === 'american' ? parseFloat(formData.exchangeRate) : null,
      currentPrice: currentPrice,
      dailyChangePercent: dailyChangePercent
    };

    // שמירה בטבלה המתאימה
    if (formData.exchange === 'israeli') {
      const updatedIsraeliStocks = [...israeliStocks, stockData];
      setIsraeliStocks(updatedIsraeliStocks);
      saveToLocalStorage(updatedIsraeliStocks, americanStocks);
    } else {
      const updatedAmericanStocks = [...americanStocks, stockData];
      setAmericanStocks(updatedAmericanStocks);
      saveToLocalStorage(israeliStocks, updatedAmericanStocks);
    }

    setShowForm(false);
    
    // איפוס הטופס
    setFormData({
      stockName: '',
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
    } else {
      const updatedAmericanStocks = americanStocks.filter(stock => stock.id !== id);
      setAmericanStocks(updatedAmericanStocks);
      saveToLocalStorage(israeliStocks, updatedAmericanStocks);
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
    
    let currentPrice = editingStock.currentPrice || 0;
    let dailyChangePercent = editingStock.dailyChangePercent || 0;
    
    if (formData.exchange === 'american') {
      const priceData = await fetchCurrentPrice(formData.stockName.trim());
      if (priceData) {
        currentPrice = priceData.currentPrice || 0;
        dailyChangePercent = priceData.changePercent || 0;
      }
    } else if (formData.exchange === 'israeli') {
      // מנייה ישראלית - לא מעדכנים מחיר
      currentPrice = 0;
      dailyChangePercent = 0;
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
      purchasePrice: '',
      quantity: '',
      purchaseDate: '',
      exchange: 'israeli',
      exchangeRate: ''
    });
  };


  // פונקציה לעריכה inline
  const handleInlineEdit = (id, field, value, exchange) => {
    if (exchange === 'israeli') {
      const updatedIsraeliStocks = israeliStocks.map(stock => 
        stock.id === id ? { ...stock, [field]: value } : stock
      );
      setIsraeliStocks(updatedIsraeliStocks);
      saveToLocalStorage(updatedIsraeliStocks, americanStocks);
    } else {
      const updatedAmericanStocks = americanStocks.map(stock => 
        stock.id === id ? { ...stock, [field]: value } : stock
      );
      setAmericanStocks(updatedAmericanStocks);
      saveToLocalStorage(israeliStocks, updatedAmericanStocks);
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

    return {
      // סיכום בשקלים
      totalPurchaseILS: israeliSummary.totalPurchaseILS + americanSummary.totalPurchaseILS,
      totalCurrentValueILS: israeliSummary.totalCurrentValueILS + americanSummary.totalCurrentValueILS,
      totalProfitILS: israeliSummary.totalProfitILS + americanSummary.totalProfitILS,
      
      // סיכום בדולרים
      totalPurchaseUSD: americanSummary.totalPurchaseUSD,
      totalCurrentValueUSD: americanSummary.totalCurrentValueUSD,
      totalProfitUSD: americanSummary.totalProfitUSD,
      
      // אחוז שינוי יומי משוקלל
      weightedDailyChange: weightedDailyChange,
      
      // השפעת שער חליפין כוללת
      totalExchangeImpact: americanSummary.totalExchangeImpact
    };
  };

  if (showForm) {
    return (
      <div className="App">
        <div className="form-container">
          <div className="form-content">
            <h1 className="form-title">{isEditMode ? 'עריכת מנייה' : 'הוספת מידע על מנייה'}</h1>
            
            <form onSubmit={handleSubmit} className="stock-form">
              <div className="form-group">
                <label htmlFor="stockName">שם מנייה *</label>
                <input
                  type="text"
                  id="stockName"
                  name="stockName"
                  value={formData.stockName}
                  onChange={handleInputChange}
                  required
                  placeholder="לדוגמה: טבע, אפל, מיקרוסופט"
                />
              </div>

              <div className="form-group">
                <label htmlFor="purchaseDate">תאריך קנייה *</label>
                <input
                  type="date"
                  id="purchaseDate"
                  name="purchaseDate"
                  value={formData.purchaseDate}
                  onChange={handleInputChange}
                  required
                />
              </div>

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

              {formData.exchange === 'american' && (
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

  return (
    <div className="App">
      <div className="welcome-container">
        <div className="welcome-content">
          <h1 className="welcome-title">ברוך הבא למערכת מעקב אחרי תיק ההשקעות שלך</h1>
          <p className="welcome-subtitle">ניהול חכם של ההשקעות שלך במקום אחד</p>
          
          {/* סיכום התיק */}
          {(israeliStocks.length > 0 || americanStocks.length > 0) && (
            <div className="portfolio-summary">
              <h2 className="portfolio-summary-title">סיכום התיק</h2>
              {(() => {
                const summary = calculatePortfolioSummary();
                return (
                  <div className="summary-grid">
                    {/* סיכום בשקלים */}
                    <div className="summary-section">
                      <h3 className="summary-section-title">סיכום בשקלים (₪)</h3>
                      <div className="summary-item">
                        <span className="summary-label">סה"כ השקעה:</span>
                        <span className="summary-value">{formatPriceWithSign(summary.totalPurchaseILS)} ₪</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">סה"כ שווי:</span>
                        <span className="summary-value">{formatPriceWithSign(summary.totalCurrentValueILS)} ₪</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">סה"כ רווח:</span>
                        <span className={`summary-value ${summary.totalProfitILS >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                          {formatPriceWithSign(summary.totalProfitILS)} ₪
                        </span>
                      </div>
                    </div>

                    {/* סיכום בדולרים */}
                    <div className="summary-section">
                      <h3 className="summary-section-title">סיכום בדולרים ($)</h3>
                      <div className="summary-item">
                        <span className="summary-label">סה"כ השקעה:</span>
                        <span className="summary-value">{formatPriceWithSign(summary.totalPurchaseUSD)} $</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">סה"כ שווי:</span>
                        <span className="summary-value">{formatPriceWithSign(summary.totalCurrentValueUSD)} $</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">סה"כ רווח:</span>
                        <span className={`summary-value ${summary.totalProfitUSD >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                          {formatPriceWithSign(summary.totalProfitUSD)} $
                        </span>
                      </div>
                    </div>

                    {/* אינדיקטורים נוספים */}
                    <div className="summary-section">
                      <h3 className="summary-section-title">אינדיקטורים</h3>
                      <div className="summary-item">
                        <span className="summary-label">אחוז שינוי יומי:</span>
                        <span className={`summary-value ${summary.weightedDailyChange >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                          {summary.weightedDailyChange.toFixed(2)}%
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
                );
              })()}
            </div>
          )}
          
          <div className="main-buttons-container">
            <button className="add-info-button" onClick={handleAddInfo}>
              לחץ כאן כדי להוסיף מידע
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
                {showAmericanColumns ? 'הסתר עמודות אמריקאיות' : 'הצג עמודות אמריקאיות'}
              </button>
            </div>
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
                      <th>סה"כ רווח בש"ח</th>
                      <th>אחוז רווח</th>
                      <th>אחוז שינוי יומי</th>
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
                            <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {profitPercentage}%
                            </td>
                            <td className={(stock.dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {stock.dailyChangePercent !== undefined && stock.dailyChangePercent !== null ? stock.dailyChangePercent.toFixed(2) : '0.00'}%
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
                            <td className={summary.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {summary.profitPercentage}%
                            </td>
                            <td className={(stocks[0].dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {stocks[0].dailyChangePercent !== undefined && stocks[0].dailyChangePercent !== null ? stocks[0].dailyChangePercent.toFixed(2) : '0.00'}%
                            </td>
                            {isEditMode && <td></td>}
                          </tr>
                          
                          {/* שורות מפורטות */}
                          {isExpanded && stocks.map((stock) => {
                            const totalPurchase = (stock.purchasePrice || 0) * (stock.quantity || 0);
                            const totalCurrentValue = (stock.currentPrice || 0) * (stock.quantity || 0);
                            const profit = totalCurrentValue - totalPurchase;
                            const profitPercentage = calculateProfitPercentage(totalPurchase, totalCurrentValue);
                            
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
                                <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                                  {profitPercentage}%
                                </td>
                                <td className={(stock.dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                                  {stock.dailyChangePercent !== undefined && stock.dailyChangePercent !== null ? stock.dailyChangePercent.toFixed(2) : '0.00'}%
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
                      <th>תאריך קנייה</th>
                      <th>מחיר קנייה</th>
                      <th>כמות</th>
                      <th>סה"כ רכישה בדולר</th>
                      <th>סה"כ רכישה בשקל</th>
                      <th>שער חליפין ביום הקנייה</th>
                      <th>שער חליפין היום</th>
                      <th>מחיר נוכחי</th>
                      <th>סה"כ שווי בדולר</th>
                      <th>סה"כ שווי בש"ח</th>
                      <th>סה"כ רווח ($)</th>
                      <th>סה"כ רווח (₪)</th>
                      <th>אחוז רווח</th>
                      <th>אחוז שינוי יומי</th>
                      <th>השפעת שער חליפין</th>
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
                            <td>{formatPriceWithSign(totalPurchaseUSD)} $</td>
                            <td>{formatPriceWithSign(totalPurchaseILS)} ₪</td>
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
                            <td>{formatPrice(currentExchangeRate)}</td>
                            <td>{formatPriceWithSign(stock.currentPrice)} $</td>
                            <td>{formatPriceWithSign(totalCurrentValueUSD)} $</td>
                            <td>{formatPriceWithSign(totalCurrentValueILS)} ₪</td>
                            <td className={profitUSD >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {formatPriceWithSign(profitUSD)} $
                            </td>
                            <td className={profitILS >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {formatPriceWithSign(profitILS)} ₪
                            </td>
                            <td className={profitPercentage >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {profitPercentage}%
                            </td>
                            <td className={(stock.dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {stock.dailyChangePercent ? stock.dailyChangePercent.toFixed(2) : '0.00'}%
                            </td>
                            <td className={exchangeRateImpact >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {formatPriceWithSign(exchangeRateImpact)} ₪
                            </td>
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
                            <td>פתח קיבוץ</td>
                            <td>פתח קיבוץ</td>
                            <td>{summary.totalQuantity}</td>
                            <td>{formatPriceWithSign(totalPurchaseUSD)} $</td>
                            <td>{formatPriceWithSign(totalPurchaseILS)} ₪</td>
                            <td>פתח קיבוץ</td>
                            <td>{formatPrice(stocks[0].currentExchangeRate || stocks[0].exchangeRate || 0)}</td>
                            <td>{formatPriceWithSign(averageCurrentPriceUSD)} $</td>
                            <td>{formatPriceWithSign(totalCurrentValueUSD)} $</td>
                            <td>{formatPriceWithSign(totalCurrentValueILS)} ₪</td>
                            <td className={totalProfitUSD >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {formatPriceWithSign(totalProfitUSD)} $
                            </td>
                            <td className={totalProfitILS >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {formatPriceWithSign(totalProfitILS)} ₪
                            </td>
                            <td className={profitPercentage >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {profitPercentage}%
                            </td>
                            <td className={(stocks[0].dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {stocks[0].dailyChangePercent ? stocks[0].dailyChangePercent.toFixed(2) : '0.00'}%
                            </td>
                            <td className={totalExchangeRateImpact >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {formatPriceWithSign(totalExchangeRateImpact)} ₪
                            </td>
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
                                <td>{formatPriceWithSign(totalPurchaseUSD)} $</td>
                                <td>{formatPriceWithSign(totalPurchaseILS)} ₪</td>
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
                                <td>{formatPrice(currentExchangeRate)}</td>
                                <td>{formatPriceWithSign(stock.currentPrice)} $</td>
                                <td>{formatPriceWithSign(totalCurrentValueUSD)} $</td>
                                <td>{formatPriceWithSign(totalCurrentValueILS)} ₪</td>
                                <td className={profitUSD >= 0 ? 'profit-positive' : 'profit-negative'}>
                                  {formatPriceWithSign(profitUSD)} $
                                </td>
                                <td className={profitILS >= 0 ? 'profit-positive' : 'profit-negative'}>
                                  {formatPriceWithSign(profitILS)} ₪
                                </td>
                                <td className={profitPercentage >= 0 ? 'profit-positive' : 'profit-negative'}>
                                  {profitPercentage}%
                                </td>
                                <td className={(stock.dailyChangePercent || 0) >= 0 ? 'profit-positive' : 'profit-negative'}>
                                  {stock.dailyChangePercent ? stock.dailyChangePercent.toFixed(2) : '0.00'}%
                                </td>
                                <td className={exchangeRateImpact >= 0 ? 'profit-positive' : 'profit-negative'}>
                                  {formatPriceWithSign(exchangeRateImpact)} ₪
                                </td>
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