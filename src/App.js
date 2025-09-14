import './App.css';
import { useState, useEffect } from 'react';

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
        console.log(`🔄 מעדכן מניות ישראליות (${israeliStocks.length} מניות)`);
        const updatedIsraeliStocks = [];
        for (const stock of israeliStocks) {
          const result = await fetchIsraeliStockPrice(stock.stockName);
          if (result !== null) {
            updatedIsraeliStocks.push({
              ...stock,
              currentPrice: result.price || result,
              dailyChangePercent: result.changePercent || 0
            });
          } else {
            updatedIsraeliStocks.push(stock);
          }
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

  // פונקציה לחיפוש אחוז שינוי יומי ב-HTML של bizportal.co.il
  const parseDailyChange = async (html) => {
    try {
      console.log(`🔍 מחפש אחוז שינוי יומי בעמוד bizportal.co.il...`);
      
      // דפוסים לחיפוש אחוז שינוי יומי
      const changePatterns = [
        // חיפוש ספציפי באחוז שינוי יומי - עדיפות ראשונה
        /0%/g,
        // eslint-disable-next-line no-useless-escape
        /([+-]?[0-9]+\.?[0-9]*)\s*%/g,
        // eslint-disable-next-line no-useless-escape
        /([+-]?[0-9]+\.?[0-9]*)%/g,
        
        // חיפוש עם סימנים
        // eslint-disable-next-line no-useless-escape
        /([+-]?[0-9]+\.?[0-9]*)\s*%?\s*([+-])/g,
        
        // חיפוש כללי
        // eslint-disable-next-line no-useless-escape
        /([+-]?[0-9]+\.?[0-9]*)/g
      ];
      
      for (const pattern of changePatterns) {
        const match = html.match(pattern);
        if (match) {
          // טיפול מיוחד לדפוס הראשון (0%)
          if (pattern.source === '0%') {
            console.log(`✅ אחוז שינוי 0% נמצא ב-bizportal.co.il`);
            return 0;
          }
          
          // טיפול בדפוסים אחרים
          if (match[1]) {
            const rawChange = match[1].trim();
            console.log(`📊 אחוז שינוי גולמי שנמצא: "${rawChange}"`);
            
            // eslint-disable-next-line no-useless-escape
            const cleanChange = rawChange.replace(/[^\d,\.+-]/g, '');
            console.log(`🧹 אחוז שינוי אחרי ניקוי: "${cleanChange}"`);
            
            if (cleanChange && cleanChange !== '0' && cleanChange !== '0.00') {
              const changePercent = parseFloat(cleanChange.replace(',', ''));
              console.log(`📊 אחוז שינוי סופי: ${changePercent}%`);
              
              if (changePercent >= -100 && changePercent <= 100) {
                console.log(`✅ אחוז שינוי תקין נמצא ב-bizportal.co.il: ${changePercent}%`);
                return changePercent;
              } else {
                console.log(`❌ אחוז שינוי לא תקין: ${changePercent}%`);
              }
            } else if (cleanChange === '0' || cleanChange === '0.00') {
              // אם מצאנו 0%, זה גם תקין
              console.log(`✅ אחוז שינוי 0% נמצא ב-bizportal.co.il`);
              return 0;
            }
          }
        }
      }
      
      console.log(`❌ לא נמצא אחוז שינוי יומי ב-HTML של bizportal.co.il`);
      return 0; // ברירת מחדל
    } catch (error) {
      console.log(`❌ שגיאה בחיפוש אחוז שינוי: ${error}`);
      return 0;
    }
  };

  // פונקציה לחיפוש מחיר ב-HTML של bizportal.co.il
  const parseBizportalPrice = async (html) => {
    try {
      console.log(`🔍 מחפש מחיר בעמוד bizportal.co.il...`);
      
      // דפוסים לחיפוש מחיר ב-bizportal - מחפש את המחיר הנכון של המנייה
      const pricePatterns = [
        // חיפוש ספציפי במחיר המוצג ליד "שווי יחידה" או "0%"
        // eslint-disable-next-line no-useless-escape
        /שווי יחידה[^>]*>([0-9,\.]+)</i,
        // eslint-disable-next-line no-useless-escape
        /0%[^>]*>([0-9,\.]+)</i,
        // eslint-disable-next-line no-useless-escape
        /נכון ל[^>]*>([0-9,\.]+)</i,
        
        // חיפוש במחיר הגדול המוצג בעמוד - רק מספרים עם פסיקים
        /([0-9]{3}(?:,[0-9]{3})*)/g,
        /([0-9]{4}(?:,[0-9]{3})*)/g,
        /([0-9]{5}(?:,[0-9]{3})*)/g,
        
        // חיפוש כללי במחיר
        /([0-9]+(?:,[0-9]{3})*)/g,
        // eslint-disable-next-line no-useless-escape
        /([0-9]+(?:\.?[0-9]*))/g
      ];
      
      for (let i = 0; i < pricePatterns.length; i++) {
        const pattern = pricePatterns[i];
        console.log(`🔍 מנסה דפוס ${i + 1}/${pricePatterns.length}: ${pattern}`);
        
        const match = html.match(pattern);
        if (match && match[1]) {
          const rawPrice = match[1].trim();
          console.log(`💰 מחיר גולמי שנמצא עם דפוס ${i + 1}: "${rawPrice}"`);
          
          // eslint-disable-next-line no-useless-escape
          const cleanPrice = rawPrice.replace(/[^\d,\.]/g, '');
          console.log(`🧹 מחיר אחרי ניקוי: "${cleanPrice}"`);
          
          if (cleanPrice && cleanPrice !== '0' && cleanPrice !== '0.00') {
            const price = parseFloat(cleanPrice.replace(',', ''));
            console.log(`📊 מחיר סופי: ${price}`);
            
            if (price > 100 && price < 1000000) {
              console.log(`✅ מחיר תקין נמצא ב-bizportal.co.il: ${price}`);
              console.log(`💰 מחיר באגורות: ${price}`);
              console.log(`💰 מחיר בשקלים: ${price / 100}`);
              
              // חפש אחוז שינוי יומי
              const changePercent = await parseDailyChange(html);
              console.log(`📊 אחוז שינוי יומי: ${changePercent}%`);
              
              console.log(`🎯 מחזיר מחיר: ${price / 100}`);
              return {
                price: price / 100, // המרה מאגורות לשקלים
                changePercent: changePercent
              };
            } else {
              console.log(`❌ מחיר לא תקין (צריך להיות בין 100-1,000,000): ${price}`);
            }
          }
        } else {
          console.log(`❌ לא נמצא עם דפוס ${i + 1}`);
        }
      }
      
      console.log(`❌ לא נמצא מחיר ב-HTML של bizportal.co.il`);
      return null;
    } catch (error) {
      console.log(`❌ שגיאה בחיפוש מחיר: ${error}`);
      return null;
    }
  };

  // פונקציה לחיפוש מחיר מנייה ישראלית
  const fetchIsraeliStockPrice = async (stockInput) => {
    try {
      console.log(`🚀 מתחיל חיפוש מחיר עבור: ${stockInput}`);
      
      // בדיקה אם הקלט הוא מספר או שם
      const isNumber = /^\d+$/.test(stockInput.trim());
      console.log(`📊 סוג קלט: ${isNumber ? 'מספר' : 'שם'}`);
      
      // רשימת URLs אפשריים עבור bizportal.co.il
      const possibleUrls = [
        `https://www.bizportal.co.il/tradedfund/quote/performance/${stockInput}`,
        `https://bizportal.co.il/tradedfund/quote/performance/${stockInput}`,
        `https://www.bizportal.co.il/stock/quote/performance/${stockInput}`,
        `https://bizportal.co.il/stock/quote/performance/${stockInput}`,
        `https://www.bizportal.co.il/search?q=${stockInput}`,
        `https://bizportal.co.il/search?q=${stockInput}`
      ];
      
      // רשימת proxies
      const proxies = [
        'https://api.allorigins.win/get?url=',
        'https://cors-anywhere.herokuapp.com/',
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url='
      ];
      
      for (let urlIndex = 0; urlIndex < possibleUrls.length; urlIndex++) {
        const url = possibleUrls[urlIndex];
        console.log(`🔍 מנסה URL ${urlIndex + 1}/${possibleUrls.length}: ${url}`);
        
        for (let proxyIndex = 0; proxyIndex < proxies.length; proxyIndex++) {
          const proxy = proxies[proxyIndex];
          console.log(`🔄 מנסה עם proxy ${proxyIndex + 1}/${proxies.length}: ${proxy}`);
          
          try {
            let response;
            if (proxy === 'https://api.allorigins.win/get?url=') {
              response = await fetch(`${proxy}${encodeURIComponent(url)}`);
              const data = await response.json();
              const html = data.contents;
              console.log(`📡 תגובה דרך ${proxy}: ${response.status}`);
              console.log(`📋 HTML התקבל דרך ${proxy}: ${html.length} תווים`);
              
              if (html.includes('bizportal.co.il') && html.length > 1000) {
                console.log(`✅ זה נראה כמו עמוד של bizportal.co.il, מחפש מחיר...`);
                const result = await parseBizportalPrice(html);
                if (result) return result;
              } else {
                console.log(`❌ זה לא עמוד של bizportal.co.il או עמוד קצר מדי`);
              }
            } else if (proxy === 'https://cors-anywhere.herokuapp.com/') {
              response = await fetch(`${proxy}${url}`, {
                headers: {
                  'X-Requested-With': 'XMLHttpRequest'
                }
              });
              console.log(`📡 תגובה דרך ${proxy}: ${response.status}`);
              
              if (response.ok) {
                const html = await response.text();
                console.log(`📋 HTML התקבל דרך ${proxy}: ${html.length} תווים`);
                
                if (html.includes('bizportal.co.il') && html.length > 1000) {
                  console.log(`✅ זה נראה כמו עמוד של bizportal.co.il, מחפש מחיר...`);
                  const result = await parseBizportalPrice(html);
                  if (result) return result;
                } else {
                  console.log(`❌ זה לא עמוד של bizportal.co.il או עמוד קצר מדי`);
                }
              } else {
                console.log(`❌ שגיאה עם proxy ${proxyIndex + 1}: ${response.status} ${response.statusText}`);
              }
            } else if (proxy === 'https://corsproxy.io/?') {
              response = await fetch(`${proxy}${encodeURIComponent(url)}`);
              console.log(`📡 תגובה דרך ${proxy}: ${response.status}`);
              
              if (response.ok) {
                const html = await response.text();
                console.log(`📋 HTML התקבל דרך ${proxy}: ${html.length} תווים`);
                
                if (html.includes('bizportal.co.il') && html.length > 1000) {
                  console.log(`✅ זה נראה כמו עמוד של bizportal.co.il, מחפש מחיר...`);
                  const result = await parseBizportalPrice(html);
                  if (result) return result;
                } else {
                  console.log(`❌ זה לא עמוד של bizportal.co.il או עמוד קצר מדי`);
                }
              } else {
                console.log(`❌ שגיאה עם proxy ${proxyIndex + 1}: ${response.status} ${response.statusText}`);
              }
            } else if (proxy === 'https://api.allorigins.win/raw?url=') {
              response = await fetch(`${proxy}${encodeURIComponent(url)}`);
              console.log(`📡 תגובה דרך ${proxy}: ${response.status}`);
              
              if (response.ok) {
                const html = await response.text();
                console.log(`📋 HTML התקבל דרך ${proxy}: ${html.length} תווים`);
                
                if (html.includes('bizportal.co.il') && html.length > 1000) {
                  console.log(`✅ זה נראה כמו עמוד של bizportal.co.il, מחפש מחיר...`);
                  const result = await parseBizportalPrice(html);
                  if (result) return result;
                } else {
                  console.log(`❌ זה לא עמוד של bizportal.co.il או עמוד קצר מדי`);
                }
              } else {
                console.log(`❌ שגיאה עם proxy ${proxyIndex + 1}: ${response.status} ${response.statusText}`);
              }
            }
          } catch (error) {
            console.log(`❌ שגיאה עם proxy ${proxyIndex + 1}: ${error.message}`);
          }
        }
        
        console.log(`❌ ה-URL ${urlIndex + 1} לא עובד`);
      }
      
      console.log(`❌ כל ה-URLs נכשלו`);
      return null;
    } catch (error) {
      console.log(`❌ שגיאה בקבלת נתונים: ${error}`);
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
      console.log(`🇮🇱 מוסיף מנייה ישראלית: ${formData.stockName}`);
      const result = await fetchIsraeliStockPrice(formData.stockName.trim());
      console.log(`💰 תוצאה שהתקבלה:`, result);
      if (result) {
        currentPrice = result.price || result;
        dailyChangePercent = result.changePercent || 0;
        console.log(`✅ מחיר נוסף למנייה: ${currentPrice}`);
        console.log(`✅ אחוז שינוי יומי נוסף למנייה: ${dailyChangePercent}%`);
      } else {
        console.log(`❌ לא התקבל מחיר עבור מנייה ישראלית`);
      }
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
      setIsraeliStocks(israeliStocks.filter(stock => stock.id !== id));
    } else {
      setAmericanStocks(americanStocks.filter(stock => stock.id !== id));
    }
  };


  // פונקציה לשמירת עריכה
  const handleSaveEdit = async () => {
    if (!formData.stockName || !formData.purchasePrice || !formData.quantity || !formData.purchaseDate) {
      alert('אנא מלא את כל השדות');
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
      const result = await fetchIsraeliStockPrice(formData.stockName.trim());
      if (result) {
        currentPrice = result.price || result;
        dailyChangePercent = result.changePercent || 0;
      }
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
      setIsraeliStocks(israeliStocks.map(stock => 
        stock.id === editingStock.id ? updatedStock : stock
      ));
    } else {
      setAmericanStocks(americanStocks.map(stock => 
        stock.id === editingStock.id ? updatedStock : stock
      ));
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
      setIsraeliStocks(israeliStocks.map(stock => 
        stock.id === id ? { ...stock, [field]: value } : stock
      ));
    } else {
      setAmericanStocks(americanStocks.map(stock => 
        stock.id === id ? { ...stock, [field]: value } : stock
      ));
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
                    {israeliStocks.map((stock) => {
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
                      <th>אחוז רווח</th>
                      <th>אחוז שינוי יומי</th>
                      <th>השפעת שער חליפין</th>
                      {isEditMode && <th>פעולות</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {americanStocks.map((stock) => {
                      const totalPurchaseUSD = (stock.purchasePrice || 0) * (stock.quantity || 0);
                      const totalPurchaseILS = totalPurchaseUSD * (stock.exchangeRate || 0);
                      const totalCurrentValueUSD = (stock.currentPrice || 0) * (stock.quantity || 0);
                      const currentExchangeRate = stock.currentExchangeRate || stock.exchangeRate || 0;
                      const totalCurrentValueILS = totalCurrentValueUSD * currentExchangeRate;
                      const profitPercentage = calculateProfitPercentage(totalPurchaseILS, totalCurrentValueILS);
                      
                      // חישוב השפעת שער החליפין
                      const exchangeRateImpact = (totalPurchaseUSD * stock.exchangeRate) - (totalCurrentValueUSD * currentExchangeRate);
                      
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