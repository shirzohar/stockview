import './App.css';
import { useState, useEffect } from 'react';

function App() {
  const [showForm, setShowForm] = useState(false);
  const [showAdditionalColumns, setShowAdditionalColumns] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
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

  // עדכון אוטומטי של מחירי מניות אמריקאיות, אחוז שינוי יומי ושער החליפין כל 10 שניות
  useEffect(() => {
    const interval = setInterval(async () => {
      if (americanStocks.length > 0) {
        // קבלת שער החליפין הנוכחי
        const currentExchangeRate = await fetchExchangeRate();
        
        const updatedStocks = [];
        for (const stock of americanStocks) {
          const priceData = await fetchCurrentPrice(stock.stockName);
          if (priceData !== null) {
            updatedStocks.push({
              ...stock, 
              currentPrice: priceData.currentPrice,
              dailyChangePercent: priceData.changePercent,
              currentExchangeRate: currentExchangeRate || stock.currentExchangeRate || stock.exchangeRate
            });
          } else {
            updatedStocks.push({
              ...stock,
              currentExchangeRate: currentExchangeRate || stock.currentExchangeRate || stock.exchangeRate
            });
          }
        }
        setAmericanStocks(updatedStocks);
        saveToLocalStorage(israeliStocks, updatedStocks);
      }
    }, 10000); // 10 שניות

    return () => clearInterval(interval);
  }, [americanStocks, israeliStocks]);

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
        const changePercent = meta.regularMarketChangePercent;
        return { currentPrice, changePercent };
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

  const handleToggleAdditionalColumns = () => {
    setShowAdditionalColumns(!showAdditionalColumns);
  };

  const handleToggleEditMode = () => {
    setIsEditMode(!isEditMode);
    setEditingRow(null); // איפוס השורה בעריכה
  };

  const handleRowClick = (stockId, exchange) => {
    if (!isEditMode) return;
    setEditingRow({ id: stockId, exchange });
  };

  const handleSaveEdit = (stockId, exchange, updatedData) => {
    if (exchange === 'israeli') {
      const updatedStocks = israeliStocks.map(stock => 
        stock.id === stockId ? { ...stock, ...updatedData } : stock
      );
      setIsraeliStocks(updatedStocks);
      saveToLocalStorage(updatedStocks, americanStocks);
    } else {
      const updatedStocks = americanStocks.map(stock => 
        stock.id === stockId ? { ...stock, ...updatedData } : stock
      );
      setAmericanStocks(updatedStocks);
      saveToLocalStorage(israeliStocks, updatedStocks);
    }
    setEditingRow(null);
  };

  const handleDeleteStock = (stockId, exchange) => {
    if (exchange === 'israeli') {
      const updatedStocks = israeliStocks.filter(stock => stock.id !== stockId);
      setIsraeliStocks(updatedStocks);
      saveToLocalStorage(updatedStocks, americanStocks);
    } else {
      const updatedStocks = americanStocks.filter(stock => stock.id !== stockId);
      setAmericanStocks(updatedStocks);
      saveToLocalStorage(israeliStocks, updatedStocks);
    }
    setEditingRow(null);
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
    
    // קבלת מחיר נוכחי ואחוז שינוי יומי מ-API אם זה מנייה אמריקאית
    let currentPrice = 0;
    let dailyChangePercent = 0;
    if (formData.exchange === 'american') {
      const priceData = await fetchCurrentPrice(formData.stockName.trim());
      if (priceData) {
        currentPrice = priceData.currentPrice || 0;
        dailyChangePercent = priceData.changePercent || 0;
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

  // קומפוננטה לעריכת שורה
  const EditRowForm = ({ stock, exchange, onSave, onDelete }) => {
    const [editData, setEditData] = useState({
      stockName: stock.stockName,
      purchaseDate: stock.purchaseDate,
      purchasePrice: stock.purchasePrice.toString(),
      quantity: stock.quantity.toString(),
      exchangeRate: stock.exchangeRate ? stock.exchangeRate.toString() : ''
    });

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setEditData(prev => ({
        ...prev,
        [name]: value
      }));
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      const updatedData = {
        stockName: editData.stockName,
        purchaseDate: editData.purchaseDate,
        purchasePrice: parseFloat(editData.purchasePrice),
        quantity: parseInt(editData.quantity),
        exchangeRate: exchange === 'american' ? parseFloat(editData.exchangeRate) : stock.exchangeRate
      };
      onSave(stock.id, exchange, updatedData);
    };

    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        handleSubmit(e);
      }
    };

    return (
      <tr className="edit-row">
        <td>
          <input
            type="text"
            name="stockName"
            value={editData.stockName}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            className="edit-input"
          />
        </td>
        <td>
          <input
            type="date"
            name="purchaseDate"
            value={editData.purchaseDate}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            className="edit-input"
          />
        </td>
        <td>
          <input
            type="number"
            name="purchasePrice"
            value={editData.purchasePrice}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            step="0.01"
            min="0"
            className="edit-input"
          />
        </td>
        <td>
          <input
            type="number"
            name="quantity"
            value={editData.quantity}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            min="1"
            className="edit-input"
          />
        </td>
        <td>
          <span className="edit-display">{formatPriceWithSign((parseFloat(editData.purchasePrice) || 0) * (parseInt(editData.quantity) || 0))} $</span>
        </td>
        {exchange === 'american' && (
          <>
            {showAdditionalColumns && <td>
              <span className="edit-display">{formatPriceWithSign((parseFloat(editData.purchasePrice) || 0) * (parseInt(editData.quantity) || 0) * (parseFloat(editData.exchangeRate) || 0))} ₪</span>
            </td>}
            {showAdditionalColumns && <td>
              <input
                type="number"
                name="exchangeRate"
                value={editData.exchangeRate}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                step="0.0001"
                min="0"
                className="edit-input"
              />
            </td>}
            {showAdditionalColumns && <td>
              <span className="edit-display">{formatPrice(stock.currentExchangeRate || stock.exchangeRate || 0)}</span>
            </td>}
          </>
        )}
        <td>
          <span className="edit-display">{formatPriceWithSign(stock.currentPrice || 0)} $</span>
        </td>
        <td>
          <span className="edit-display">{formatPriceWithSign((stock.currentPrice || 0) * (parseInt(editData.quantity) || 0))} $</span>
        </td>
        {exchange === 'american' && showAdditionalColumns && <td>
          <span className="edit-display">{formatPriceWithSign((stock.currentPrice || 0) * (parseInt(editData.quantity) || 0) * (stock.currentExchangeRate || stock.exchangeRate || 0))} ₪</span>
        </td>}
        <td>
          <span className="edit-display">
            {calculateProfitPercentage(
              exchange === 'american' ? 
                (parseFloat(editData.purchasePrice) || 0) * (parseInt(editData.quantity) || 0) * (parseFloat(editData.exchangeRate) || 0) :
                (parseFloat(editData.purchasePrice) || 0) * (parseInt(editData.quantity) || 0),
              exchange === 'american' ? 
                (stock.currentPrice || 0) * (parseInt(editData.quantity) || 0) * (stock.currentExchangeRate || stock.exchangeRate || 0) :
                (stock.currentPrice || 0) * (parseInt(editData.quantity) || 0)
            )}%
          </span>
        </td>
        {exchange === 'american' && (
          <>
            <td>
              <span className="edit-display">{stock.dailyChangePercent ? stock.dailyChangePercent.toFixed(2) : '0.00'}%</span>
            </td>
            {showAdditionalColumns && <td>
              <span className="edit-display">
                {formatPriceWithSign(
                  ((parseFloat(editData.purchasePrice) || 0) * (parseInt(editData.quantity) || 0) * (parseFloat(editData.exchangeRate) || 0)) - 
                  ((stock.currentPrice || 0) * (parseInt(editData.quantity) || 0) * (stock.currentExchangeRate || stock.exchangeRate || 0))
                )} ₪
              </span>
            </td>}
          </>
        )}
        <td>
          <div className="edit-actions">
            <button 
              type="button" 
              className="delete-button"
              onClick={() => onDelete(stock.id, exchange)}
              title="מחק שורה"
            >
              🗑️ מחק
            </button>
          </div>
        </td>
      </tr>
    );
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
          
          <div className="buttons-container">
            <button className="add-info-button" onClick={handleAddInfo}>
              הוספת מידע חדש
            </button>
            <button className="additional-data-button" onClick={handleToggleAdditionalColumns}>
              {showAdditionalColumns ? 'הסתרת נתונים נוספים' : 'הצגת נתונים נוספים'}
            </button>
            <button className="edit-button" onClick={handleToggleEditMode}>
              {isEditMode ? 'יציאה מעריכה' : 'עריכה'}
            </button>
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
                    </tr>
                  </thead>
                  <tbody>
                    {israeliStocks.map((stock) => {
                      const totalPurchase = (stock.purchasePrice || 0) * (stock.quantity || 0);
                      const totalCurrentValue = (stock.currentPrice || 0) * (stock.quantity || 0);
                      const profit = totalCurrentValue - totalPurchase;
                      const profitPercentage = calculateProfitPercentage(totalPurchase, totalCurrentValue);
                      
                      // בדיקה אם השורה נמצאת בעריכה
                      const isEditing = editingRow && editingRow.id === stock.id && editingRow.exchange === 'israeli';
                      
                      if (isEditing) {
                        return (
                          <EditRowForm
                            key={stock.id}
                            stock={stock}
                            exchange="israeli"
                            onSave={handleSaveEdit}
                            onDelete={handleDeleteStock}
                          />
                        );
                      }
                      
                      return (
                        <tr 
                          key={stock.id}
                          className={isEditMode ? 'editable-row' : ''}
                          onClick={() => handleRowClick(stock.id, 'israeli')}
                        >
                          <td>{stock.stockName}</td>
                          <td>{formatDate(stock.purchaseDate)}</td>
                          <td>{formatPrice(stock.purchasePrice)}</td>
                          <td>{stock.quantity}</td>
                          <td>{formatPrice(totalPurchase)}</td>
                          <td>{formatPrice(stock.currentPrice)}</td>
                          <td>{formatPrice(totalCurrentValue)}</td>
                          <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                            {formatPriceWithSign(profit)}
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
                <table className="stocks-table american-stocks-table">
                  <thead>
                    <tr>
                      <th>שם מנייה</th>
                      <th>תאריך קנייה</th>
                      <th>מחיר קנייה</th>
                      <th>כמות</th>
                      <th>סה"כ רכישה בדולר</th>
                      {showAdditionalColumns && <th>סה"כ רכישה בשקל</th>}
                      {showAdditionalColumns && <th>שער חליפין ביום הקנייה</th>}
                      {showAdditionalColumns && <th>שער חליפין היום</th>}
                      <th>מחיר נוכחי</th>
                      <th>סה"כ שווי בדולר</th>
                      {showAdditionalColumns && <th>סה"כ שווי בש"ח</th>}
                      <th>אחוז רווח</th>
                      <th>אחוז שינוי יומי</th>
                      {showAdditionalColumns && <th>השפעת שער חליפין</th>}
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
                      
                      // בדיקה אם השורה נמצאת בעריכה
                      const isEditing = editingRow && editingRow.id === stock.id && editingRow.exchange === 'american';
                      
                      if (isEditing) {
                        return (
                          <EditRowForm
                            key={stock.id}
                            stock={stock}
                            exchange="american"
                            onSave={handleSaveEdit}
                            onDelete={handleDeleteStock}
                          />
                        );
                      }
                      
                      return (
                        <tr 
                          key={stock.id}
                          className={isEditMode ? 'editable-row' : ''}
                          onClick={() => handleRowClick(stock.id, 'american')}
                        >
                          <td>{stock.stockName}</td>
                          <td>{formatDate(stock.purchaseDate)}</td>
                          <td>{formatPriceWithSign(stock.purchasePrice)} $</td>
                          <td>{stock.quantity}</td>
                          <td>{formatPriceWithSign(totalPurchaseUSD)} $</td>
                          {showAdditionalColumns && <td>{formatPriceWithSign(totalPurchaseILS)} ₪</td>}
                          {showAdditionalColumns && <td>{formatPrice(stock.exchangeRate)}</td>}
                          {showAdditionalColumns && <td>{formatPrice(currentExchangeRate)}</td>}
                          <td>{formatPriceWithSign(stock.currentPrice)} $</td>
                          <td>{formatPriceWithSign(totalCurrentValueUSD)} $</td>
                          {showAdditionalColumns && <td>{formatPriceWithSign(totalCurrentValueILS)} ₪</td>}
                          <td className={profitPercentage >= 0 ? 'profit-positive' : 'profit-negative'}>
                            {profitPercentage}%
                          </td>
                          <td className={stock.dailyChangePercent >= 0 ? 'profit-positive' : 'profit-negative'}>
                            {stock.dailyChangePercent ? stock.dailyChangePercent.toFixed(2) : '0.00'}%
                          </td>
                          {showAdditionalColumns && (
                            <td className={exchangeRateImpact >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {formatPriceWithSign(exchangeRateImpact)} ₪
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