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
    exchangeRate: '',
    currentPrice: ''
  });

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

  // שמירת נתונים ב-LocalStorage
  const saveToLocalStorage = (israeliData, americanData) => {
    localStorage.setItem('israeliStocks', JSON.stringify(israeliData));
    localStorage.setItem('americanStocks', JSON.stringify(americanData));
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

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // יצירת אובייקט עם הנתונים
    const stockData = {
      id: Date.now(), // מזהה ייחודי
      stockName: formData.stockName,
      purchaseDate: formData.purchaseDate,
      purchasePrice: parseFloat(formData.purchasePrice),
      quantity: parseInt(formData.quantity),
      exchangeRate: formData.exchange === 'american' ? parseFloat(formData.exchangeRate) : null,
      currentPrice: parseFloat(formData.currentPrice)
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
      exchangeRate: '',
      currentPrice: ''
    });
  };

  const handleBackToHome = () => {
    setShowForm(false);
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

  const calculateProfitPercentage = (purchaseValue, currentValue) => {
    if (purchaseValue === 0 || !purchaseValue || !currentValue) return 0;
    return ((currentValue - purchaseValue) / purchaseValue * 100).toFixed(2);
  };

  if (showForm) {
    return (
      <div className="App">
        <div className="form-container">
          <div className="form-content">
            <h1 className="form-title">הוספת מידע על מנייה</h1>
            
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
                <label htmlFor="currentPrice">מחיר נוכחי *</label>
                <input
                  type="number"
                  id="currentPrice"
                  name="currentPrice"
                  value={formData.currentPrice}
                  onChange={handleInputChange}
                  required
                  step="0.01"
                  min="0"
                  placeholder="0.00"
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
                <button type="submit" className="submit-button">
                  שמור מידע
                </button>
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
          
          <button className="add-info-button" onClick={handleAddInfo}>
            לחץ כאן כדי להוסיף מידע
          </button>

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
                    </tr>
                  </thead>
                  <tbody>
                    {israeliStocks.map((stock) => {
                      const totalPurchase = (stock.purchasePrice || 0) * (stock.quantity || 0);
                      const totalCurrentValue = (stock.currentPrice || 0) * (stock.quantity || 0);
                      const profit = totalCurrentValue - totalPurchase;
                      const profitPercentage = calculateProfitPercentage(totalPurchase, totalCurrentValue);
                      
                      return (
                        <tr key={stock.id}>
                          <td>{stock.stockName}</td>
                          <td>{formatDate(stock.purchaseDate)}</td>
                          <td>{formatPrice(stock.purchasePrice)}</td>
                          <td>{stock.quantity}</td>
                          <td>{formatPrice(totalPurchase)}</td>
                          <td>{formatPrice(stock.currentPrice)}</td>
                          <td>{formatPrice(totalCurrentValue)}</td>
                          <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                            {formatPrice(profit)}
                          </td>
                          <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                            {profitPercentage}%
                          </td>
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
                <table className="stocks-table">
                  <thead>
                    <tr>
                      <th>שם מנייה</th>
                      <th>תאריך קנייה</th>
                      <th>מחיר קנייה ($)</th>
                      <th>כמות</th>
                      <th>סה"כ רכישה בדולר</th>
                      <th>סה"כ רכישה בשקל</th>
                      <th>שער חליפין ביום הקנייה</th>
                      <th>שער חליפין היום</th>
                      <th>מחיר נוכחי ($)</th>
                      <th>סה"כ שווי בדולר</th>
                      <th>סה"כ שווי בש"ח</th>
                      <th>אחוז רווח</th>
                    </tr>
                  </thead>
                  <tbody>
                    {americanStocks.map((stock) => {
                      const totalPurchaseUSD = (stock.purchasePrice || 0) * (stock.quantity || 0);
                      const totalPurchaseILS = totalPurchaseUSD * (stock.exchangeRate || 0);
                      const totalCurrentValueUSD = (stock.currentPrice || 0) * (stock.quantity || 0);
                      const currentExchangeRate = stock.exchangeRate || 0; // TODO: לקבל שער נוכחי
                      const totalCurrentValueILS = totalCurrentValueUSD * currentExchangeRate;
                      const profitPercentage = calculateProfitPercentage(totalPurchaseILS, totalCurrentValueILS);
                      
                      return (
                        <tr key={stock.id}>
                          <td>{stock.stockName}</td>
                          <td>{formatDate(stock.purchaseDate)}</td>
                          <td>{formatPrice(stock.purchasePrice)}</td>
                          <td>{stock.quantity}</td>
                          <td>{formatPrice(totalPurchaseUSD)}</td>
                          <td>{formatPrice(totalPurchaseILS)}</td>
                          <td>{formatPrice(stock.exchangeRate)}</td>
                          <td>{formatPrice(currentExchangeRate)}</td>
                          <td>{formatPrice(stock.currentPrice)}</td>
                          <td>{formatPrice(totalCurrentValueUSD)}</td>
                          <td>{formatPrice(totalCurrentValueILS)}</td>
                          <td className={profitPercentage >= 0 ? 'profit-positive' : 'profit-negative'}>
                            {profitPercentage}%
                          </td>
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
