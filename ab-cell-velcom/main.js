﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)
*/

var g_headers = {
	'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'Accept-Charset': 'windows-1251,utf-8;q=0.7,*;q=0.3',
	'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4',
	'Connection': 'keep-alive',
	'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/29.0.1547.76 Safari/537.36',
};

function main(){
    var prefs = AnyBalance.getPreferences();
	
    var baseurl = "https://internet.velcom.by/";
    AnyBalance.setDefaultCharset('utf-8');
	
    checkEmpty(prefs.login, 'Введите номер телефона в международном формате!');
    checkEmpty(prefs.password, 'Введите пароль к ИССА!');
	
    var matches;
    if(!(matches = /^\+(375\d\d)(\d{7})$/.exec(prefs.login)))
		throw new AnyBalance.Error('Неверный номер телефона. Необходимо ввести номер в международном формате без пробелов и разделителей!');
	
    var phone = matches[2];
    var prefix = matches[1];
    
    var html = AnyBalance.requestGet(baseurl, g_headers);
	
	if(/JavaScript/.test(html)) {
		// Функчи из скрипта
		function toNumbers(d){var e=[];d.replace(/(..)/g,function(d){e.push(parseInt(d,16))});return e};
		function toHex(){for(var d=[],d=1==arguments.length&&arguments[0].constructor==Array?arguments[0]:arguments,e="",f=0;f<d.length;f++)e+=(16>d[f]?"0":"")+d[f].toString(16);return e.toLowerCase()};

		var a = toNumbers(getParam(html, null, null, /a\s*=\s*toNumbers\("([^"]+)/i)),//toNumbers("f45b0aa91e4d63a0643d9c9420bf72b3"),
		b = toNumbers(getParam(html, null, null, /b\s*=\s*toNumbers\("([^"]+)/i)),//toNumbers("5c6a5f08cf9bf0320bfbd8d781fa26ae"),
		c = toNumbers(getParam(html, null, null, /c\s*=\s*toNumbers\("([^"]+)/i)),//c = toNumbers("0fec5c01077762a4a1fa4156ade6d752");
		cookie = getParam(html, null, null, /document.cookie="([^"]+)="/i);
		
		AnyBalance.setCookie('internet.velcom.by', cookie, toHex(X.aG(c,2,a,b)));
		
		var href = getParam(html, null, null, /location\.href\s*=\s*"([^"]+)/i);
		if(href) {
			try {
				html = AnyBalance.requestGet(href, addHeaders({'Referer': 'https://internet.velcom.by/'}));
			} catch (e) {
				html = AnyBalance.requestGet('https://internet.velcom.by/');
			}
		}
	}
	
    var sid = getParam(html, null, null, /name="sid3" value="([^"]*)"/i);
    if(!sid){
		if(AnyBalance.getLastStatusCode() >= 400){
			var error = getParam(html, null, null, /<h1[^>]*>([\s\S]*?)<\/h1>/i, replaceTagsAndSpaces, html_entity_decode);
			if(error)
				throw new AnyBalance.Error(error);
			throw new AnyBalance.Error('Сайт временно недоступен. Пожалуйста, попробуйте ещё раз позднее.');
		}
			
		throw new AnyBalance.Error('Не удалось найти идентификатор сессии!');
    }
    
    var form = getParam(html, null, null, /(<form[^>]*name="mainForm"[^>]*>[\s\S]*?<\/form>)/i);
    if(!form)
		throw new AnyBalance.Error('Не удалось найти форму входа, похоже, velcom её спрятал. Обратитесь к автору провайдера.');

    var params = createFormParams(form, function(params, str, name, value){
	var id=getParam(str, null, null, /\bid="([^"]*)/i, null, html_entity_decode);
	if(id){
		if(/PRE/i.test(id)){ //Это префикс
			value = prefix;
		}else if(/NUMBER|MSISDN/i.test(id)){ //Это номер
			value = phone;
		}else if(/PWD/i.test(id)){ //Это пароль
			value = prefs.password.substr(0, 8);  //Велкам принимает только первые 8 символов всё равно.
		}
	}
	if(!name)
		return;
	if(name == 'user_input_0')
		value = '_next';
	if(name == 'user_input_timestamp')
		value = new Date().getTime();
	if(/^user_input_\d+8$/.test(name))
		value = '5';
	if(/^user_input_\d+9$/.test(name))
		value = '2';
	if(/^user_input_\d+10$/.test(name))
		value = '0';
	return value || '';
    });
    params.user_submit='';

    var required_headers = {
		'Referer': 'https://internet.velcom.by/work.html',
		'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.162 Safari/535.19'
    };
    
    var html = requestPostMultipart(baseurl + 'work.html', params, required_headers);

    var kabinetType, personalInfo;
    if(/_root\/PERSONAL_INFO/i.test(html)){
        personalInfo = '_root/PERSONAL_INFO';
        kabinetType = 2;
    }else if(/_root\/USER_INFO/i.test(html)){
        personalInfo = '_root/USER_INFO';
        kabinetType = 1;
    }

    AnyBalance.trace('Cabinet type: ' + kabinetType);

    if(!kabinetType){
        var error = sumParam(html, null, null, /<td[^>]+class="INFO(?:_Error|_caption)?"[^>]*>(.*?)<\/td>/ig, replaceTagsAndSpaces, html_entity_decode, create_aggregate_join(' '))
		|| sumParam(html, null, null, /<span[^>]+style="color:\s*red[^>]*>[\s\S]*?<\/span>/ig, replaceTagsAndSpaces, html_entity_decode, create_aggregate_join(' '))
	        || getParam(html, null, null, /<td[^>]+class="info_caption"[^>]*>[\s\S]*?<\/td>/ig, replaceTagsAndSpaces, html_entity_decode);
        if(error)
            throw new AnyBalance.Error(error, null, /Неверный пароль или номер телефона|Пароль должен состоять из 8 цифр/i.test(error));
        if(/Сервис временно недоступен/i.test(html))
            throw new AnyBalance.Error('ИССА Velcom временно недоступна. Пожалуйста, попробуйте позже.');
        
		AnyBalance.trace(html);
        throw new AnyBalance.Error('Не удалось войти в личный кабинет. Сайт изменен?');
    }
	// Иногда сервис недоступен, дальше идти нет смысла
	if (/По техническим причинам работа с сервисами ограничена|Сервис временно недоступен/i.test(html)) {
		var message = getParam(html, null, null, /<div class="BREAK">([^<]+)/i, replaceTagsAndSpaces, html_entity_decode);
		if(message) {
			AnyBalance.trace('Сайт ответил: ' + message);
			throw new AnyBalance.Error('ИССА Velcom временно недоступна.\n ' + message);
		}
		
		throw new AnyBalance.Error('ИССА Velcom временно недоступна. Пожалуйста, попробуйте позже.');
	}	
	
    var result = {success: true};

    //Персональная информация
    var html = requestPostMultipart(baseurl + 'work.html', {
        sid3: sid,
        user_input_timestamp: new Date().getTime(),
        user_input_0: personalInfo,
        last_id: ''
    }, required_headers);
         
    getParam(html, result, 'userName', /(?:Абонент:|ФИО)(?: \(название абонента\))?:?[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'userNum', /(?:Номер):[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'balance', /(?:Баланс основного счета|Баланс лицевого счета|Баланс):[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
    sumParam(html, result, 'balanceBonus', /(?:Баланс бонусного счета(?: \d)?):[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum);
    getParam(html, result, 'status', /(?:Текущий статус абонента|Статус абонента):[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, '__tariff', /Тарифный план:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    //getParam(html, result, 'min', /Остаток минут, SMS, MMS, (?:МБ|GPRS), включенных в абонплату:[\s\S]*?<td[^>]*>(?:[\s\S](?!<\/td>))*?(-?\d[\d,\.]*) мин(?:ут)?(?:\s*во все сети)?(?:,|\s*<)/i, replaceTagsAndSpaces, parseBalance);
	sumParam(html, result, 'min', [/Остаток исходящего бонуса:[\s\S]*?<td[^>]*>([\s\S]*?мин)/i, 
	/Остаток минут, SMS, MMS, (?:МБ|GPRS), включенных в абонплату:[\s\S]*?<td[^>]*>(?:[\s\S](?!<\/td>))*?(-?\d[\d,\.]*)\s*мин(?:ут)?(?:\s*во все сети)?/i
	], replaceTagsAndSpaces, parseBalance, aggregate_sum);
	sumParam(html, result, 'sms', /Остаток минут, SMS, MMS, (?:МБ|GPRS), включенных в абонплату:[\s\S]*?<td[^>]*>(?:[\s\S](?!<\/td>))*?(-?\d[\d,\.]*)\s*SMS/i, replaceTagsAndSpaces, parseBalance, aggregate_sum);
	
    getParam(html, result, 'min_fn', /Остаток минут, SMS, MMS, (?:МБ|GPRS), включенных в абонплату:[\s\S]*?<td[^>]*>(?:[\s\S](?!<\/td>))*?(-?\d[\d,\.]*) мин(?:ут)? на ЛН/i, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, 'min_velcom', /Остаток минут, SMS, MMS, (?:МБ|GPRS), включенных в абонплату:[\s\S]*?<td[^>]*>(?:[\s\S](?!<\/td>))*?(-?\d[\d,\.]*) мин(?:ут)? на velcom/i, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, 'traffic', /Остаток минут, SMS, MMS, (?:МБ|GPRS), включенных в абонплату:[\s\S]*?<td[^>]*>(?:[\s\S](?!<\/td>))*?(-?\d[\d,\.]*)\s*Мб/i, replaceTagsAndSpaces, parseBalance);
	getParam(html, result, 'call_barring', /Запрет исходящих с:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseDateWord);
	
    //Кабинет изменился, рассрочку надо исправлять!
    //Пока не получаем её
	if(AnyBalance.isAvailable('loan_balance', 'loan_left', 'loan_end')) {
	
	var html = requestPostMultipart(baseurl + 'work.html', {
			sid3: sid,
			user_input_timestamp: new Date().getTime(),
			user_input_0: '_root/FINANCE_INFO/INSTALLMENT',
			user_input_1: '',
			last_id: ''
		}, required_headers);
		
		 
//Ежемес. платеж 659000 руб. Остаток 7249000 руб. Погашение 01.07.2015.			
		getParam(html, result, 'loan_balance', /Ежемес. платеж ([0-9]+) руб./i, replaceTagsAndSpaces, parseBalance);
		getParam(html, result, 'loan_left', /Остаток ([0-9]+) руб./i, replaceTagsAndSpaces, parseBalance);
		getParam(html, result, 'loan_end', /Погашение ([0-9.]+)./i, replaceTagsAndSpaces, parseDate);
	
	}
	
	/*
    if(AnyBalance.isAvailable('traffic')){
        html = requestPostMultipart(baseurl + 'work.html', {
            sid3: sid,
            user_input_timestamp: new Date().getTime(),
            user_input_0: '_root/TPLAN/PACKETS',
            last_id: '',
            user_input_1: -1
        }, required_headers);

        var packetMb = getParam(html, null, null, /Остаток интернет-трафика:[^<]*?(\d+)\s*Мб/i, replaceFloat, parseFloat) || 0;
        var packetKb = getParam(html, null, null, /Остаток интернет-трафика:[^<]*?(\d+)\s*Кб/i, replaceFloat, parseFloat) || 0;

        result.traffic = traffic + packetMb + packetKb/1000;
    }
*/    
    AnyBalance.setResult(result);
}