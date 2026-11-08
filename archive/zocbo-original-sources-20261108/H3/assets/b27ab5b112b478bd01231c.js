var util = {
    // 빈 값 체크
    isEmpty:function(v_p) {
        var fg = true;
        if(v_p) {
            if(v_p != "" && v_p != undefined) {
                fg = false;
            }
        }
        return fg;
    },

    // post방식 form으로 전송
    sendPost:function(url, data) {
        var f = document.createElement("form");
        f.action = url;
        f.method = "post";

        var data_a = data.split("&");
        for(var p_i = 0; p_i < data_a.length; p_i++) {
            var str = data_a[p_i];
            var str_a = str.split("=");
            var name_v = str_a[0];
            var value_v = str_a[1];
            var input_o = document.createElement("input");
            input_o.name = name_v;
            input_o.value = value_v;
            f.appendChild(input_o);
        }
        document.body.appendChild(f);
        f.submit();
        f.parentNode.removeChild(f);
    },
    
    // 객체 키를 소문자 변환
    keysToLowerCase:function(obj) {
        if(obj == null || obj == undefined) return null;
        var keys = Object.keys(obj);
        var n = keys.length;
        while (n--) {
            var key = keys[n]; // "cache" it, for less lookups to the array
            if (key !== key.toLowerCase()) { // might already be in its lower case version
                obj[key.toLowerCase()] = obj[key] // swap the value to a new lower case key
                delete obj[key] // delete the old key
            }
        }
        return (obj);
    },

    // 이벤트 객체 검색
    findEventObject:function(ev, obj){
        if(ev) {
            var evt = window.event || ev;
            if(obj == null) obj = evt.srcElement || evt.target;
        }
        if(obj) {
            if(obj.nodeName == "BODY") return null;
        }
        else {
            return null;
        }
        var tmp = obj.getAttribute("data-act");
        if(tmp) {
            return obj;
        }
        return util.findEventObject(null, obj.parentNode);
    },

    // 객체 속성으로 검색
    findObjectByAttr:function(obj, attr, value) {
        if(obj) {
            if(obj.NodeName == "BODY") {
                return null;
            }
            var chk = obj.getAttribute(attr);
            if(value) {
                if(attr == "class") {
                    if(chk == null) chk = "";
                    if(chk.indexOf(value) >= 0) {
                        return obj;
                    }
                    else {
                        return util.findObjectByAttr(obj.parentNode, attr, value);
                    }
                }
                else {
                    if(chk == value) {
                        return obj;
                    }
                    else {
                        return util.findObjectByAttr(obj.parentNode, attr, value);
                    }
                }
            }
            else {
                if(chk) {
                    return obj;
                }
                else {
                    return util.findObjectByAttr(obj.parentNode, attr, value);
                }
            }

        }
        return null;
    },

    // 숫자화
    toNumber: function (s) {
        s = s + "";
        var _0xd5f9x66, _0xd5f9x67;
        _0xd5f9x67 = '';
        if (s.indexOf('.') >= 0) {
            _0xd5f9x66 = s.substring(0, s.indexOf('.'));
            _0xd5f9x67 = s.substring(s.indexOf('.'));
        } else {
            _0xd5f9x66 = s;
        };
        if (_0xd5f9x66.length <= 3) {
            return _0xd5f9x66 + _0xd5f9x67;
        };
        var _0xd5f9x5d = Math.ceil(_0xd5f9x66.length / 3);
        var _0xd5f9x68 = _0xd5f9x66.length % 3;
        if (_0xd5f9x68 == 0) {
            _0xd5f9x68 = 3;
        };
        var _0xd5f9x69 = _0xd5f9x66.substring(0, _0xd5f9x68);
        for (var i = 1; i < _0xd5f9x5d; i++) {
            _0xd5f9x69 += ',' + _0xd5f9x66.substring(_0xd5f9x68, _0xd5f9x68 + 3);
            _0xd5f9x68 += 3;
        };
        return _0xd5f9x69 + _0xd5f9x67;
    },

    // seconds를 MM:SS형태로 리턴.
    toStringMS:function(seconds) {
        if(isNaN(seconds)) {
            return "00:00";
        }
        if(seconds <= 0) {
            return "00:00";
        }
        var m_v = parseInt(seconds / 60);
        var s_v = seconds % 60;
        if(m_v < 10) m_v = "0" + m_v;
        if(s_v < 10) s_v = "0" + s_v;
        return m_v + ":" + s_v;
    },

    // 날짜를 문자열 변환
    toStringYMD: function (str, deli) {
        if (str==null) return "";
        if(str.length < 8) return "";
        // str = _h.format.getOnlyNumber(str);
        var y = str.substr(0, 4);
        var m = str.substr(4, 2);
        var d = str.substr(6, 2);
        return y + deli + m + deli + d;
    },

    // 파라미터를 json으로 변환
    queryStringToJSON: function(str) {
        if(str == null) {
            str = location.search.slice(1);
        }
        var pairs = str.split('&');
        
        var result = {};
        pairs.forEach(function(pair) {
            pair = pair.split('='); // alert(pair[1]);
            result[pair[0]] = decodeURIComponent(pair[1] || '');
        });
    
        return JSON.parse(JSON.stringify(result));
    },

    // json을 파라미터로 변환
    jsonToQuerystring:function(jsonArray) {
        str = "";
        if(jsonArray) {
            for(var i = 0; i < jsonArray.length ; i++) {
                var item = jsonArray[i];
                if(i > 0) {
                    str = str + "&";
                }
                str = str + item.name + "=" + item.value;
            }
        }
        return str;
    },

    // json배열을 객체로 변환
    JsonConvert:function(jsonArray) {
        jd = {};
        if(jsonArray) {
            for(var i = 0; i < jsonArray.length ; i++) {
                var item = jsonArray[i];
                jd[item.name] = item.value;
            }
        }
        return jd;
    },

    // 문자열 일부분 가리기
    mask:function(str, len, mark) {
        if(str) {
            if(str.length > len) {
                var rtn = str.substring(0, len);
                var cnt = str.length - len;
                for(var i = 0; i < cnt; i++) {
                    rtn = rtn + "" + mark;
                }
                return rtn;
            }
            else {
                return str;
            }
        }
        else {
            return "";
        }
    },

    // 문자열 바이트 수 구하기
    calcByteLen:function(s){
        var b = 0;
        var i =0;
        var c = "";
        for(b=i=0;s[i];i++){
            c=s.charCodeAt(i);b+=1+(c>127)+(c>2047) 
        }
        return b;
    },

    // 문자열을 바이트 수로 자르고 '...'문자열 붙이기
    cutStr: function(str, limitBytes){  
        var bytes = util.calcByteLen(str);

        if(bytes > limitBytes) {
            var overBytes = bytes - limitBytes;
            var removeWordNum = overBytes / 3;
            str = str.substring(0, str.length - removeWordNum);
            util.cutStr(str);

            str += "...";   
        } 

        return str;
    },

    // 문자열을 바이트 수로 자르기
    cutInputStr: function(str, limitBytes){
        var bytes = util.calcByteLen(str);

        if(bytes > limitBytes) {
            var overBytes = bytes - limitBytes;
            var removeWordNum = overBytes / 3;
            str = str.substring(0, str.length - removeWordNum);
            str = util.cutInputStr(str, limitBytes);
        } 

        return str;
    },

    // 문자열을 길이로 자르고 '...'문자열 붙이기
    cutStrUseLength: function(str, len){
        var rStr = "";

        if(str.length > len) {
            rStr = str.substring(0, len);
            rStr = rStr + "...";
        } else {
            rStr = str;
        }

        return rStr;
    },

    // 오늘 날짜와 비교
    isToday: function(str) {
        var d = new Date();
        var y = d.getFullYear();
        var m = d.getMonth()+1;
        var _d = d.getDate();

        var todayDate = y + "-" + m + "-" + _d;

        var spl = str.split('-');

        var d1 = new Date(y, m, _d);
        var d2 = new Date(spl[0], spl[1], spl[2]);

        var diff = d1 - d2;
        var currDay = 24 * 60 * 60 * 1000;

        if(parseInt(diff/currDay) == 0) {
            return true;
        } else {
            return false;
        }
    },

    // 날짜를 문자열로 구하기
    getDateStr: function(myDate){
        var year = myDate.getFullYear();
        var month = ("0"+(myDate.getMonth()+1)).slice(-2);
        var day = ("0"+myDate.getDate()).slice(-2);
        return ( year + '-' + month + '-' + day );
    },

    // 날짜 개월 변경하기
    prevMonth: function(month) {
        var d = new Date();
        var monthOfYear = d.getMonth();
        d.setMonth(monthOfYear - month);
        return this.getDateStr(d);
    },

    // 날짜 일수 변경하기
    prevDay : function(days) {
        var d = new Date();
        var dayOfMonth = d.getDate();
        d.setDate(dayOfMonth - days);
        return this.getDateStr(d);
    },

    // 문자열에서 img태그 검색
    searchBetweenStr : function (orgStr, firstStr, lastStr){
        var uppperStr = orgStr.toUpperCase();
        var sLen = uppperStr.indexOf("<IMG");
        var eLen = uppperStr.substr(sLen).indexOf(">");
        var rstStr = "";

        if(sLen != -1 && eLen != -1){
            var subStr = orgStr.substr(sLen, eLen + 1);
            rstStr = subStr.trim();
        }

        return rstStr;
    },

    // 제한 수가 넘어가면 '제한 수 + 문자열' 반환
    limitViews : function(views, limitViews, appendStr){
        if(views <= limitViews){
            return views;
        }

        return limitViews + appendStr;
    },

    // 문자열에서 태그 삭제
    removeTag : function(str, isSpace) {

        var regexp = /(<([^>]+)>)/ig;

        if(isSpace) {
            str = str.replace(regexp, " ");
        } else {
            str = str.replace(regexp, "");
        }

        return str;
    },

    arrayFilter : function(array) {

        if (array == null) return;

        if (array.length == 0) return [];

        array = array.filter(function(item, idx, array) {
             return array.indexOf(item) == idx;
        });

        return array;
    },

    // 리스트를 배열로 변환 
    arrayValueAdd: function(list){
        var array = [];

        for(var i=0; i<list.length; i++) {
            var item = list[i];
            array.push(item.Value);
        }

        return array;
    },

    // 날짜비교하여 시간차 반환
    getDateDiff : function (date1,date2){
        var arrDate1 = date1.split("-");
        var getDate1 = new Date(parseInt(arrDate1[0]),parseInt(arrDate1[1])-1,parseInt(arrDate1[2]));
        var arrDate2 = date2.split("-");
        var getDate2 = new Date(parseInt(arrDate2[0]),parseInt(arrDate2[1])-1,parseInt(arrDate2[2]));
        
        var getDiffTime = getDate2.getTime() - getDate1.getTime();
        
        return Math.floor(getDiffTime / 1000);
    },

    // 파일이름 유효성 검사
    checkUploadFileName: function(fileName){
        var rst = true;

        // 한문체크
        var regex = /.*[\u2e80-\u2eff\u31c0-\u31ef\u3200-\u32ff\u3400-\u4dbf\u4e00-\u9fbf\uf900-\ufaff]+.*/g;

        // 한글포함체크
        var isWithKR = /.*[ㄱ-ㅎ|ㅏ-ㅖ|가-힣]+.*/;

        // 영문과 숫자로만 이루어진 파일명인지 체크 
        // var isEngNum = /[^\w"{}[\]()<>?_|~`!@#$%^&*-+\"'\\.,\/\-]+/g;
        var isEngNum = /[^\wㄱ-ㅎㅏ-ㅖ가-힣"{}[\]()<>?_|~`!@#$%^&*-+\"'\\.,\/\-]+/g;
        if(isEngNum.test(fileName)){
            rst = false;
        }

        if(rst) {
            // _hLog(isWithKR.exec(fileName));
            _hLog(regex.exec(fileName));
        }

        return rst;
    },
	htmlOutPut: function(html) {
		var rst = null;

		rst = html.replace(/&lt;/g, "<").replaceAll(/&gt;/g, ">");
		return rst;
	}
};


/**===========================================================================================================
 * @Project     : Form Lib Project
 * @Source      : h.form.js
 * @Description : 범용 함수 모음
 * @Version     : v0.8.8
 *
 * Copyright(c) 2011 NewFrom All rights reserved
 * ===========================================================================================================
 *  No        DATE      Author                  Description
 * ===========================================================================================================
 *  0.8.0   2014/05/26  hpiece@gmail.com        Initial Coding
 * ===========================================================================================================
 */

if (typeof (_h) != 'object' || _h == null) {
    _h = {};
};

// Cookie 관련 처리.
_h.cookie = {
    set: function (p_cookie_name, p_cookie_value, p_expire) {
        var expire = new Date();
        expire.setDate(expire.getDate() + parseInt(p_expire)); 
        //if (p_cookie_name=="lang")
        //  _hLog("expire.toGMTString() : " + expire.toGMTString());
        document.cookie = p_cookie_name + '=' + escape(p_cookie_value) + '; path=/; expires=' + expire.toGMTString() + ';';
    },
    get: function (p_cookie_name) {
        var p_cookie_name = p_cookie_name + '=';
        var _cookie_data = document.cookie;
        if (_cookie_data.length > 0) {
            var _start_idx = _cookie_data.indexOf(p_cookie_name);
            if (_start_idx != -1) {
                _start_idx += p_cookie_name.length;
                var _end_idx = _cookie_data.indexOf(';', _start_idx);
                if (_end_idx == -1) {
                    _end_idx = _cookie_data.length;
                }
                return unescape(_cookie_data.substring(_start_idx, _end_idx));
            } else {
                return null;
            };
        } else {
            return null;
        }
    },
    del: function (p_cookie_name) {
        var _expire = new Date();
        _expire.setDate(_expire.getDate() - 1);
        document.cookie = p_cookie_name + '= ' + '; expires=' + _expire.toGMTString() + '; path=/';
    },
    setAES: function (p_cookie_name, p_cookie_value, p_expire) {
        var expire = new Date();
        expire.setDate(expire.getDate(), parseInt(p_expire));
        //today['setDate'](today['getDate']() + parseInt(p_expire));
        document.cookie = p_cookie_name + '=' + AES_Encode(escape(p_cookie_value)) + '; path=/; expires=' + expire.toGMTString() + ';';
    },
    getAES: function (p_cookie_name) {
        var p_cookie_name = p_cookie_name + '=';
        var _cookie_data = document.cookie;
        if (_cookie_data.length > 0) {
            var _start_idx = _cookie_data.indexOf(p_cookie_name);
            if (_start_idx != -1) {
                _start_idx += p_cookie_name.length;
                var _end_idx = _cookie_data.indexOf(';', _start_idx);
                if (_end_idx == -1) {
                    _end_idx = _cookie_data.length;
                }
                return unescape(AES_Decode(_cookie_data.substring(_start_idx, _end_idx)));
            } else {
                return null;
            };
        } else {
            return null;
        }
    }
};

_h.form = {
    showAlert : function(msg) {
        common.alert("알림", msg, null, {});
    },

    showErrMsg:function(f, formObj) {
        var s_v = "[data-form='" + formObj.name + "']";
        var obj = f.querySelector(s_v);
        _hLog("showErrmsg=" + obj + " str=" + s_v);
        if(obj) {
            obj.style.display = "";
            return true;
        }
        return false;
    },
    // form을 submit하기 전에 해당 값중에 validation 체크가 필요한 경우 자동으로 체크후 true/false를 리턴.
    // false인 경우는 'data-msg'의 값을 alsert으로 보여준다.
    // data-req="true"이고, data-exp=""값의 종류로 validation 체크,
    // select : '선택값이 '-1'이 아니면 정상 선택으로 처리.
    // textarea : data-max, data-min 값으로 판단. 
    // input radio : 'data-req'유무로만 체크
    // input checkbox : 반드시 체크해야 함.
    // input text : data-max, data-min, date-exp로 판단.
    //              data-ext : 'email', 'number', 'url', 'date', 'alphaNumber'
    checkValid : function(f) {
        var rtn = true;
        if(f.nodeName != "FORM")    return false;
        var objs = f.querySelectorAll('input[data-req="true"]');
        var _cnt = 0;
        var _name = ""; // 이전 객체의 name
        var _type = ""; // 이전 객체의 타임
        var _value  = "";   // 이전 객체의 선택 값.
        var _msg = "";

        $(f).find("[data-form]").css("display","none");

        for(_cnt = 0; _cnt < objs.length ; _cnt++) {
            var item = objs[_cnt];
            if(item.nodeName != "INPUT") continue;
            
            if(_type != item.type || _name != item.name) {
                if(_type == "radio") {
                    if(_value != true) {
                        if(_h.form.showErrMsg(f, item) == false) {
                            _msg = item.getAttribute("data-msg");
                            if(_msg == null) {
                                _msg = item.getAttribute("placeholder");
                            }
                            _h.form.showAlert(_msg);
                        }
                        return false;
                    }
                }
            }

            if(item.type == "radio") {
                if(item.checked == false) continue;
                _value = true;
            }
            else if(item.type == "checkbox") {
                if(item.checked == false) {
                    if(_h.form.showErrMsg(f, item) == false) {
                        _msg = item.getAttribute("data-msg");
                        if(_msg == null) {
                            _msg = item.getAttribute("placeholder");
                        }
                        _h.form.showAlert(item.getAttribute("data-msg"));
                    }
                    return false;
                }
            }
            else if(item.type == "text" || item.type == "password" || item.type == "hidden" || item.type == "tel" || item.type == "email") {
                var _exp    = item.getAttribute("data-exp");
                var _max    = parseInt(item.getAttribute("data-max"));
                var _min    = parseInt(item.getAttribute("data-min"));
                var _chk = true;

                if(_exp == "email") {
                    _chk = _h.valid.isEmail(item.value);
                }
                else if(_exp == "number") {
                    _chk = _h.valid.isNumber(item.value);
                }
                else if(_exp == "url") {
                    _chk = _h.valid.isUrl(item.value);
                }
                else if(_exp == "date") {
                    _chk = _h.valid.isDate(item.value);
                }
                else if(_exp == "alphaNumber") {
                    _chk = _h.valid.isAlphaNumeric(item.value);
                }
                else if(_exp == "range") {
                    _chk = _h.valid.isNumber(item.value);
                    if(_chk) {
                        var r_max   = parseInt(item.getAttribute("range-max"));
                        var r_min   = parseInt(item.getAttribute("range-min"));
                        var _val = parseInt(item.value);
                        if(r_min <= _val && r_max >= _val) {
                        }
                        else {
                            _chk = false;
                        }
                    }
                }

                if(_chk == false) {
                    if(_h.form.showErrMsg(f, item) == false) {
                        _msg = item.getAttribute("data-msg");
                        if(_msg == null) {
                            _msg = item.getAttribute("placeholder");
                        }
                        _h.form.showAlert(_msg);
                    }
                    return false;
                }

                if(_min != NaN && _min > 0) {
                    _chk = _h.valid.isMinLength(item.value, _min);
                    if(_chk == false) {
                        if(_h.form.showErrMsg(f, item) == false) {
                            _msg = item.getAttribute("data-msg");
                            if(_msg == null) {
                                _msg = item.getAttribute("placeholder");
                            }
                            _h.form.showAlert(_msg);
                        }
                        return false;
                    }
                }
                else {
                    _chk = _h.valid.isMinLength(item.value, 1);
                    if(_chk == false) {
                        if(_h.form.showErrMsg(f, item) == false) {
                            _msg = item.getAttribute("data-msg");
                            if(_msg == null) {
                                _msg = item.getAttribute("placeholder");
                            }
                            _h.form.showAlert(_msg);
                        }
                        return false;
                    }
                }

                if(_max != NaN && _max > 0) {
                    _chk = _h.valid.isMaxLength(item.value, _max);
                    if(_chk == false) {
                        if(_h.form.showErrMsg(f, item) == false) {
                            _msg = item.getAttribute("data-msg");
                            if(_msg == null) {
                                _msg = item.getAttribute("placeholder");
                            }
                            _h.form.showAlert(_msg);
                        }
                        return false;
                    }
                }

            }
            
            if(_type != item.type || _name != item.name) {
                _value = null;
            }

            _name   = item.name;
            _type   = item.type;
            _msg    = item.getAttribute("data-msg");
        }

        objs = f.querySelectorAll("select[data-req='true']");
        for(_cnt = 0; _cnt < objs.length ; _cnt++) {
            var item = objs[_cnt];
            if(item.nodeName != "SELECT") continue;
            _chk = _h.valid.isMinLength($(item).val(), 1);
            if(_chk == false) {
                if(_h.form.showErrMsg(f, item) == false) {
                    _msg = item.getAttribute("data-msg");
                    if(_msg == null) {
                        _msg = item.getAttribute("placeholder");
                    }
                    _h.form.showAlert(_msg);
                }
                return false;
            }
        }

        objs = f.querySelectorAll("textarea[data-req='true']");
        for(_cnt = 0; _cnt < objs.length ; _cnt++) {
            var item = objs[_cnt];
            var _max    = parseInt(item.getAttribute("data-max"));
            var _min    = parseInt(item.getAttribute("data-min"));
            if(item.nodeName != "TEXTAREA") continue;
            _chk = _h.valid.isMinLength($(item).val(), 1);
            if(_chk == false) {
                if(_h.form.showErrMsg(f, item) == false) {
                    _msg = item.getAttribute("data-msg");
                    if(_msg == null) {
                        _msg = item.getAttribute("placeholder");
                    }
                    _h.form.showAlert(_msg);
                }
                return false;
            }
        }

        // objs = f.querySelectorAll("textarea[data-req='true']");
        // for(_cnt = 0; _cnt < objs.length ; _cnt++) {
        //  var item = objs[_cnt];
        //  var _max    = parseInt(item.getAttribute("data-max"));
        //  var _min    = parseInt(item.getAttribute("data-min"));
        //  if(item.nodeName != "TEXTAREA") continue;
        //  _chk = _h.valid.isMinLength($(item).val(), 1);
        //  if(_chk == false) {
        //      _msg = item.getAttribute("data-msg");
        //      if(_msg == null) {
        //          _msg = item.getAttribute("placeholder");
        //      }
        //      _h.form.showAlert(_msg);
        //      return false;
        //  }
        // }
        return rtn;
    },
    
    getFormData : function(f) {
        if(f.nodeName != "FORM")    return false;
        var method = f.getAttribute("method");
        var url = f.getAttribute("action");

        var data = "";
        var _fcnt = 0;

        var objs = f.querySelectorAll("input");
        var _cnt = 0;
        for(_cnt = 0; _cnt < objs.length ; _cnt++) {
            var item = objs[_cnt];
            if(item.nodeName != "INPUT") continue;
            if(item.type == "radio" && item.checked == false) continue;
            if(_fcnt > 0)   data = data + "&";
            data = data + item.name + "=" + encodeURIComponent($(item).val());
            _fcnt++;
        }

        objs = f.querySelectorAll("select");
        for(_cnt = 0; _cnt < objs.length ; _cnt++) {
            var item = objs[_cnt];
            if(item.nodeName != "SELECT") continue;
            if(_fcnt > 0)   data = data + "&";
            data = data + item.name + "=" + encodeURIComponent($(item).val());
            _fcnt++;
        }

        objs = f.querySelectorAll("textarea");
        for(_cnt = 0; _cnt < objs.length ; _cnt++) {
            var item = objs[_cnt];
            if(item.nodeName != "TEXTAREA") continue;
            if(_fcnt > 0)   data = data + "&";
            data = data + item.name + "=" + encodeURIComponent($(item).val());
            _fcnt++;
        }
        return data;
    },
    
    submit : function(f, _callback) {
        if(f.nodeName != "FORM")    return false;
        var method = f.getAttribute("method");
        var url = f.getAttribute("action");

        var data = "";
        var _fcnt = 0;

        var objs = f.querySelectorAll("input");
        var _cnt = 0;
        for(_cnt = 0; _cnt < objs.length ; _cnt++) {
            var item = objs[_cnt];
            if(item.nodeName != "INPUT") continue;
            if(item.type == "radio" && item.checked == false) continue;
            if(_fcnt > 0)   data = data + "&";
            data = data + item.name + "=" + encodeURIComponent($(item).val());
            _fcnt++;
        }

        objs = f.querySelectorAll("select");
        for(_cnt = 0; _cnt < objs.length ; _cnt++) {
            var item = objs[_cnt];
            if(item.nodeName != "SELECT") continue;
            if(_fcnt > 0)   data = data + "&";
            data = data + item.name + "=" + encodeURIComponent($(item).val());
            _fcnt++;
        }

        objs = f.querySelectorAll("textarea");
        for(_cnt = 0; _cnt < objs.length ; _cnt++) {
            var item = objs[_cnt];
            if(item.nodeName != "TEXTAREA") continue;
            if(_fcnt > 0)   data = data + "&";
            data = data + item.name + "=" + encodeURIComponent($(item).val());
            _fcnt++;
        }
//      alert(data);
        $.ajax({
            type: method,
            cache: false,
            url: url,
            data : data,
            dataType: "html",
            success: function(res) {
                if(typeof(_callback) == "function") {
                    var json = eval("(" + res + ")");
                    _callback(json);
                }
                else {
                    alert(res);
                }
            },
            error: function(xhr, ajaxOptions, thrownError) {
                Metronic.unblockUI(el);
                var msg = 'Error on reloading the content. Please check your connection and try again.';
                if (error == "toastr" && toastr) {
                    toastr.error(msg);
                } else if (error == "notific8" && $.notific8) {
                    $.notific8('zindex', 11500);
                    $.notific8(msg, {
                        theme: 'ruby',
                        life: 3000
                    });
                } else {
                    alert(msg);
                }
            }
        });

    },
    
    send:function() {
        $.ajax({
            type: "GET",
            cache: false,
            url: url,
            dataType: "html",
            success: function(res) {
                Metronic.unblockUI(el);
                el.html(res);
            },
            error: function(xhr, ajaxOptions, thrownError) {
                Metronic.unblockUI(el);
                var msg = 'Error on reloading the content. Please check your connection and try again.';
                if (error == "toastr" && toastr) {
                    toastr.error(msg);
                } else if (error == "notific8" && $.notific8) {
                    $.notific8('zindex', 11500);
                    $.notific8(msg, {
                        theme: 'ruby',
                        life: 3000
                    });
                } else {
                    alert(msg);
                }
            }
        });
    }
};



_h.valid = {
    isEmail: function (str) {
        // contributed by Scott Gonzalez: http://projects.scottsplayground.com/email_address_validation/
        return /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i.test(str);
    },
    isUrl: function (str) {
        // contributed by Scott Gonzalez: http://projects.scottsplayground.com/iri/
        return /^(https?|s?ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(str);
    },
    isDate: function (str) {
        return !/Invalid|NaN/.test(new Date(str).toString());
    },
    isDateISO: function (str) {
        return /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(str);
    },
    isNumber: function (str) {
        if (str.trim()=="") return false;
        return /^-?(?:\d+|\d{1,3}(?:,\d{3})+)?(?:\.\d+)?$/.test(str);
    },
    isDigits: function (str) {
        return /^\d+$/.test(str); 
        //return /^[0-9]*$/.test(str);
    },
    isEng: function (str) {
        return /^[a-zA-Z]+$/.test(str);
    },
    isKor: function (str) {
        return /^[가-힣]+$/.test(str);
    },
    isKorEng: function (str) {
        return /^[가-힣a-zA-Z]+$/.test(str);
    },
    isEngKor: function (str) {
        return /^[가-힣a-zA-Z]+$/.test(str);
    },
    isAlphaNumeric: function (str) {
        return /^\w+$/i.test(str);
    },
    isInteger: function (str) {
        return /^-?\d+$/.test(str);
    },
    //대문자만 확인 가능. 
    isYNS: function (str) {
        return /y|n/.test(str);
    },
    //대문자만 확인 가능. 
    isYNL: function (str) {
        return /Y|N/.test(str);
    },
    //대소문자만 구분 없이 확인 가능. <- 요거 안됨... 나중에 더 찾아보자...
    isYNSL: function (str) {
        return /\(?i\)y|\(?i\)n/.test(str);
    },
    isSSN: function (str) {
        str = str.replace("-", "");

        if (/[^0-9-]+/.test(str))
            return false;

        var ssnCheck = 0;
        for (var i = 0; i < 12; i++) {
            ssnCheck += (i % 8 + 2) * value.charAt(i);
        }
        ssnCheck = (11 - ssnCheck % 11) % 10;

        if(ssnCheck != str.charAt(12)) {
            return false;
        }

        return true;
    },
    isBSSN: function (str) {
        str = str.replace("-", "");
        str = str.replace("-", "");

        var sum = 0;
        var getlist =new Array(10);
        var chkvalue =new Array("1","3","7","1","3","7","1","3","5");
        for(var i=0; i<10; i++) { getlist[i] = str.substring(i, i+1); }
        for(var i=0; i<9; i++) { sum += getlist[i]*chkvalue[i]; }
        sum = sum + parseInt((getlist[8]*5)/10);
        sidliy = sum % 10;
        sidchk = 0;
        if(sidliy != 0) { sidchk = 10 - sidliy; }
        else { sidchk = 0; }
        if(sidchk != getlist[9]) {
            return false;
        }
        return true;
    },
    isCreditcard: function (str) {
        // based on http://en.wikipedia.org/wiki/Luhn
        // accept only spaces, digits and dashes
        if ( /[^0-9 \-]+/.test(str) ) {
            return false;
        }
        var nCheck = 0,
            nDigit = 0,
            bEven = false;

        str = str.replace(/\D/g, "");

        for (var n = str.length - 1; n >= 0; n--) {
            var cDigit = str.charAt(n);
            nDigit = parseInt(cDigit, 10);
            if ( bEven ) {
                if ( (nDigit *= 2) > 9 ) {
                    nDigit -= 9;
                }
            }
            nCheck += nDigit;
            bEven = !bEven;
        }

        return (nCheck % 10) === 0;
    },
    isMinLength: function (str, minLen) {
        return str.trim().length >= minLen;
    },
    isMaxLength: function (str, maxLen) {
        return str.trim().length <= maxLen;
    },
    isRangeLength: function (str, minLen, maxLen) {
        return ( str.trim().length >= minLen && str.trim().length <= maxLen );
    },
    isRangeLength2: function (str, minLen, maxLen) { 
        _hLog("_h.util.getByteLength('"+ str +"') : "+_h.util.getByteLength(str.trim()));
        _hLog("_h.util.getStringLength('"+ str +"') : "+_h.util.getStringLength(str.trim()));
        return ( _h.util.getStringLength(str.trim()) >= minLen && _h.util.getStringLength(str.trim()) <= maxLen );
    },
    isMin: function (str, min) {
        return str >= min;
    },
    isMax: function (str, max) {
        return str <= max;
    },
    isRange: function (str, min, max) {
        return (str >= min && str <= max);
    },
    isMinWords: function (str, min) {
        return _h.util.stripHtml(str).match(/\b\w+\b/g).length >= min;
    },
    isMaxWords: function (str, max) {
        return _h.util.stripHtml(str).match(/\b\w+\b/g).length <= max;
    },
    isRangeWords: function (str, min, max) {
        var len = _h.util.stripHtml(str).match(/\b\w+\b/g).length;
        return ( len <= max && len >= min);
    },
    isIPv4: function (str) {
        return /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/i.test(str);
    },
    isIPv6: function (str) {
        return /^((([0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){6}:[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){5}:([0-9A-Fa-f]{1,4}:)?[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){4}:([0-9A-Fa-f]{1,4}:){0,2}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){3}:([0-9A-Fa-f]{1,4}:){0,3}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){2}:([0-9A-Fa-f]{1,4}:){0,4}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){6}((\b((25[0-5])|(1\d{2})|(2[0-4]\d)|(\d{1,2}))\b)\.){3}(\b((25[0-5])|(1\d{2})|(2[0-4]\d)|(\d{1,2}))\b))|(([0-9A-Fa-f]{1,4}:){0,5}:((\b((25[0-5])|(1\d{2})|(2[0-4]\d)|(\d{1,2}))\b)\.){3}(\b((25[0-5])|(1\d{2})|(2[0-4]\d)|(\d{1,2}))\b))|(::([0-9A-Fa-f]{1,4}:){0,5}((\b((25[0-5])|(1\d{2})|(2[0-4]\d)|(\d{1,2}))\b)\.){3}(\b((25[0-5])|(1\d{2})|(2[0-4]\d)|(\d{1,2}))\b))|([0-9A-Fa-f]{1,4}::([0-9A-Fa-f]{1,4}:){0,5}[0-9A-Fa-f]{1,4})|(::([0-9A-Fa-f]{1,4}:){0,6}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){1,7}:))$/i.test(str);
    },
    //예)_h.valid.isPattern(str,/^AR\d{4}$/), _h.valid.isPattern(str,/^AR\d{4}$/);
    isPattern: function (str, pattern) {
        if (typeof pattern === 'string') {
            pattern = new RegExp('^(?:' + pattern + ')$');
        }
        return pattern.test(str);
    },
    isPassWord: function(str){
        return /([a-zA-Z0-9?=.*!@#$%^&*()-+_=]){6,12}/.test(str);
    }
};