﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)
*/
var g_headers = {
	'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'Accept-Charset': 'windows-1251,utf-8;q=0.7,*;q=0.3',
	'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4',
	'Connection': 'keep-alive',
	'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36',
};

function parseTrafficMb(str){
    var val = parseBalance(str);
    if(isset(val))
        val = Math.round(val/1024*100)/100;
    return val;
}

function parseTime (str) {
    var t = parseFloat(str);
    if(!str || !t)
    return;

    return 60 * parseFloat(str)
    }

function main() {
	var prefs = AnyBalance.getPreferences();
	var baseurl = 'https://ihelper-prp.mts.com.ua/SelfCareUA/';
	AnyBalance.setDefaultCharset('utf-8');
	checkEmpty(prefs.login, 'Введите логин!');
	checkEmpty(prefs.password, 'Введите пароль!');
	var html = AnyBalance.requestGet(baseurl + 'Logon', g_headers);
	var captchaa;
	if (AnyBalance.getLevel() >= 7) {
		AnyBalance.trace('Пытаемся ввести капчу');
		var captcha = AnyBalance.requestGet(baseurl + 'Captcha/ShowForLogon');
		captchaa = AnyBalance.retrieveCode("Пожалуйста, введите код с картинки", captcha);
		AnyBalance.trace('Капча получена: ' + captchaa);
	} else {
		throw new AnyBalance.Error('Провайдер требует AnyBalance API v7, пожалуйста, обновите AnyBalance!');
	}

	html = AnyBalance.requestPost(baseurl + 'Logon', {
		Captcha:captchaa,
		PhoneNumber: prefs.login,
		Password: prefs.password,
	}, addHeaders({Referer: baseurl + 'Logon'}));

	if (!/logOff/i.test(html)) {
		if(/InvalidCaptcha/i.test(html))
			throw new AnyBalance.Error('Не верно введены символы с картинки!');

		var error = getParam(html, null, null, /(?:ОШИБКА<\/div>\s+<\/div>\s+<div[^>]*>\s+<div[^>]*>|Error.[\s\S]*text":")([\s\S]*?)(?:<\/div>|","isError)/i, replaceTagsAndSpaces, html_entity_decode);
		if (error)
			throw new AnyBalance.Error(error, null, /Невірний пароль/i.test(error));

		throw new AnyBalance.Error('Не удалось зайти в личный кабинет. Сайт изменен?');
	}

	var result = {success: true};
	//Тариф и денежные балансы
	getParam (html, result, '__tariff', /Тариф<\/span>\s+<span[^>]*>([\s\S]*?)<\/span>/i, replaceTagsAndSpaces, html_entity_decode);
	getParam(html, result, 'balance', /Баланс<\/span>\s+<span[^>]*>([\s\S]*?)<\/span>/i, replaceTagsAndSpaces, parseBalance);
	getParam(html, result, 'bonus_balance', /Денежный бонусный счет: осталось\s*([\s\S]*?)\s*грн/i, replaceTagsAndSpaces, parseBalance);
	getParam (html, result, 'bonus_balance_termin', />Денежный бонусный счет: осталось [\s\S]* грн. Срок действия до([^<]*)<\/span>/i, replaceTagsAndSpaces, parseDate);

	//Секция бонусов
	getParam(html, result, 'bonusy', /ВАШ БОНУСНИЙ РАХУНОК<\/div>\s+<div[^>]*>\s+<div[^>]*>([\s\S]*?)<\/div>/i, replaceTagsAndSpaces, parseBalance);
	getParam(html, result, 'bonusy_burn', /буде списано\s*(\d+)\s*бонусів/i, replaceTagsAndSpaces, parseBalance);
	getParam (html, result, 'bonusy_burn_termin', />([^<]*) буде списано/i, replaceTagsAndSpaces, parseDate);

        //Минуты
	//Минуты в сети МТС которые действуют в регионе
	getParam (html, result, 'hvylyny_net1', /минут в день для внутрисетевых звонков: осталось\s*(\d+)\s*бесплатных секунд/i, replaceTagsAndSpaces, parseBalance);
	getParam (html, result, 'hvylyny_net1', />залишилось\s*([\d\.,]+)\s*безкоштовних хвилин<\/span>/i, parseBalance, parseTime);

	//Минуты в сети МТС которые действуют вне региона
	getParam (html, result, 'hvylyny_net2', />Осталось\s*([\d\.,]+)\s*минут<\/span>/i, parseBalance, parseTime);

	//Пакетные минуты в сети МТС общенациональные
	getParam (html, result, 'hvylyny_net3', />Осталось\s*(\d+)\s*бесплатных секунд/i, replaceTagsAndSpaces, parseBalance);
	getParam (html, result, 'hvylyny_net3_termin', />Осталось \d+ бесплатных секунд до\s*([^<]*)\s*<\/span>/i, replaceTagsAndSpaces, parseDate);

	//СМС и ММС
	getParam (html, result, 'sms_used', />Израсходовано:(\d+)\s*смс.<\/span>/ig, replaceTagsAndSpaces, parseBalance);
	getParam (html, result, 'mms_used', />Израсходовано:(\d+)\s*mms.<\/span>/ig, replaceTagsAndSpaces, parseBalance);

	//Трафик
	//Ежедневный пакет?
	getParam (html, result, 'traffic2', /Кб.<\/span>\s*<\/div>\s*<div[^>]*>\s*<span[^>]*>Осталось:\s*(\d+,?\d* *(Кб|kb|mb|gb|кб|мб|гб|байт|bytes)).<\/span>/i, null, parseTrafficMb);
	//Смарт.NET
	getParam (html, result, 'traffic4', /секунд<\/span>\s*<\/div>\s*<div[^>]*>\s*<span[^>]*>Осталось:\s*(\d+,?\d* *(Кб|kb|mb|gb|кб|мб|гб|байт|bytes)).<\/span>/i, null, parseTrafficMb);

	//Пример работы с масивом
//	sumParam (html, result, 'traffic', /Осталось:\s*(\d+,?\d* *(Кб|kb|mb|gb|кб|мб|гб|байт|bytes)).<\/span>/ig, null, parseTrafficMb);
//	for(var i=0; i<arr.length; ++i){
//          getParam(arr[i], result, 'counter' + i);
//      }

	//Особые параметры
	getParam (html, result, 'PZS_MB_opera', />OperaMini: ПЗС за первое событие для APN opera:\s*(\d+)<\/span>/ig, replaceTagsAndSpaces, parseBalance);
	getParam (html, result, 'PZS_first', />Снятие ПЗС за первое событие:\s*(\d+)<\/span>/ig, replaceTagsAndSpaces, parseBalance);
	getParam (html, result, 'PZS_first_out', />Единоразовое ПЗС за пределами региона \(Смартфон\):\s*(\d+)<\/span>/ig, replaceTagsAndSpaces, parseBalance);

	//Второстепенные параметры
	getParam(html, result, 'spent', /Витрачено за номером \+\d\d\d \d\d \d\d\d-\d\d-\d\d за період з \d\d.\d\d до \d\d.\d\d.\d\d\d\d \(з урахуванням ПДВ і збору до ПФ\)<\/span>\s*<div[^>]*><span>([\s\S]*?)\s*<small>грн/i, replaceTagsAndSpaces, parseBalance);
	getParam (html, result, 'phone', /Номер<\/span>\s+<span[^>]*>([^<]*)<\/span>/i, replaceTagsAndSpaces, html_entity_decode);

	AnyBalance.setResult(result);
}