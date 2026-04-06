function generateData(e) {
  let ss = SpreadsheetApp.getActive();
  var spreadsheetName = ss.getName(); // Имя таблицы
  var sheetName = ss.getSheetName(); // Имя листа
  var spreadsheetId = ss.getId(); // id листа
  var row = ss.getCurrentCell().getRow(); // Номер строки
  var column = ss.getCurrentCell().getColumn(); // Номер столбца
  var values = ss.getActiveRange().getValues(); // Массив новых данных
  var user = e.user; // Пользователь, который вносил изменения
  var date = new Date(); // Дата
  sendWebhook(spreadsheetName, sheetName, row, column, values, user, date, spreadsheetId);
}
function sendWebhook(spreadsheetName, sheetName, row, column, values, user, date, spreadsheetId) {
  var endpoint = "https://h.albato.ru/wh/21/1lf9b7l/k_hFApK1RRpFtg3pWPuS_BhDcPJxAU970N-ZtMBWLJ8/";
  var jsonarray = JSON.stringify;
  var payload = {
    spreadsheetName: spreadsheetName,
    sheetName: sheetName,
    row: row,
    column: column,
    values: JSON.stringify(values),
    user: user,
    date: date,
    spreadsheetId: spreadsheetId,
  };
  var options = {
    method: "post",
    payload: payload,
  };
  UrlFetchApp.fetch(endpoint, options);
}
function createSpreadsheetOpenTrigger() {
  const ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger("generateData").forSpreadsheet(ss).onChange().create();
}
