var MgBotApiClient = require('mg-api-client');
const api = new MgBotApiClient({
  host: 'https://mg-s1.retailcrm.pro',
  token: '0_0',
  apiVersion: 'v1'
}).client;

const php_server = 'http://192.168.1.48/node_bot/main/retail.php'

const token = 'dgfkdgfkjl09045u0dgfokjfmldasla3hui';

var mysql = require('mysql');
const connection = mysql.createConnection({
    'host': 'localhost',
    'user': 'pmauser',
    'password': '123456',
    'database': 'droid',
    'port': 3306
});
connection.connect();

const qs   = require('querystring');
const url = require('url');
const WebSocket = require('ws');
const http_request = require('request');

var http = require('http');
const server = new http.Server(function (request, response)
{
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Access-Control-Allow-Origin", "*");

    var query = url.parse(request.url, true);

        if (query.pathname == '/send' && query.query.dialog && query.query.message)
        {
            response.statusCode = 200;
            search_chat(query.query.dialog, query.query.message, send_message);
            response.end(query.query.message);
        }
        else if (query.pathname == '/save' && request.method == 'POST')
        {
            let body = '';
            let params;

                request.on('data', chunk => {
                    body += chunk.toString();
                });
                request.on('end', () => {
                    params = qs.parse(body);

                    if (!params.question || !params.answer)
                    {
                        response.statusCode = 400;
                        response.end("NO");                          
                        return ;
                    }
                    connection.query("INSERT INTO from_chat (question, answer) VALUES ?", [[[params.question, params.answer]]], function (err, result) {
                        if (err)
                        {
                            response.statusCode = 400;
                            response.end("NO");                              
                            throw err;
                        }
                        else
                        {
                            response.statusCode = 200;
                            response.end("OK");
                        }     
                      });
                });
        }
        else if (query.pathname == '/show' && request.method == 'GET')
        {
            connection.query("SELECT * FROM from_chat", function (error, result)
            {
                if (error)
                {
                    response.statusCode = 400;
                    response.end("NO");
                    throw error;
                }
                else if (!result.length)
                {
                    response.statusCode = 200;
                    response.end();
                }
                else
                {
                    let objs = [];

                        for (let i = 0;i < result.length; i++)
                        {
                            objs.push({rows: result[i]});
                        }

                    response.statusCode = 200;
                    response.end(JSON.stringify(objs));
                }
            });
        }
        else if (query.pathname == '/lala' && request.method == 'GET')
        {
            connection.query("UPDATE from_chat SET active=" + query.query.str + " WHERE id=" + query.query.id, function (err, result)
            {
                if (err)
                {
                    response.statusCode = 400;
                    response.end("NO");                        
                    throw err;
                }
                response.statusCode = 200;
                response.end('{"status": "OK"}');
            });             
        }
        else if (query.pathname == '/delete' && request.method == 'GET')
        {
            let id   = parseInt(query.query.delete);
            let type = query.query.type;

                if (!id || id <= 0 || !type)
                {
                    response.statusCode = 400;
                    response.end("NO");
                    return ;                 
                }
                if (type != 'static')
                {
                    connection.query("DELETE FROM from_chat WHERE id=" + id, function (err, result)
                    {
                        if (err)
                        {
                            response.statusCode = 400;
                            response.end("NO");                        
                            throw err;
                        }
                        response.statusCode = 200;
                        response.end('{"status": "OK"}');
                    });
                }
                else
                {
                    let flag = parseInt(query.query.flag);

                    connection.query("UPDATE from_chat SET active=" + flag + " WHERE id=" + id, function (err, result)
                    {
                        if (err)
                        {
                            response.statusCode = 400;
                            response.end("NO");                        
                            throw err;
                        }
                        response.statusCode = 200;
                        response.end('{"status": "OK"}');
                    });                    
                }
        }
        else
        {
            response.statusCode = 404;
            response.end("its 404 nigga");
        }
});

function search_chat (id, text, callback)
{
    api.getDialogs({id: id})
    .then(function (list)
    {
        if (list[0].chat_id === undefined)
            return ;
        callback(list[0].chat_id, text);
        return ;
    })
    .catch(function (e) {
        console.log(e);
    });
}

function send_message (chat_id, txt)
{
    let message = {
        chat_id: chat_id,
        content: txt,
        scope: 'public',
        type: 'text'
    };

    api.sendMessage(message)
    .then(function (result)
    {
        console.log(result);
    })
    .catch(function (e) {
        console.log(e);
    });
}

function switch_dialog (dialog_id, dialog)
{
    api.assignDialog(dialog_id, dialog)
    .then(function (result)
    {
        console.log(result);
    })
    .catch(function (e) {
        console.log(e);
    });
}

const define_hello_from_bot =
    "Добрый день, добро пожаловать в чат магазина 2Droida. \
    Напишите в чат команду для получения информации\
\
    bot 1 - для получения информации по заказу\
    bot 2  номер квитанции (пример bot 2 1)  - для получения информации по СЦ\
    Для остальных пунктов введите цифру команды для выполнения действия\n\n";


function init_first_message (dialog_id)
{
    connection.query("SELECT * FROM from_chat", function (error, result)
    {
        let str = define_hello_from_bot;
        let j   = 1;

        if (error)                      
            throw error;
        if (!result || !result[0])
            return ;
        
        for (let i = 0; i < result.length; i++)
        {
            if (result[i].is_static != null && result[i].active)
            {
                str += j + ') ' + result[i]['question'] + "\n";

                ++j;
            }
        }

        for (let i = 0; i < result.length; i++)
        {
            if (result[i].is_static == null)
            {
                str += j + ') ' + result[i]['question'] + "\n";

                ++j;
            }
        }

        str += j + ') ' + "попросить менеджера ответить" + "\n\nХорошего вам дня!";

       send_message(dialog_id, str);
    });
}

function empty_int (num)
{
    return !num || num == NaN || num == undefined || !num || num == null || num < 0 ? 1 : 0;
}



function message_handler (message, dialog_id, last_dialog)
{   
    let tmp_arr = message.split(' ');
    let arr     = [];
    let stat    = 0;
    let j       = 0;

    for (let i = 0; i < tmp_arr.length; i++)
    {
        let tmp = tmp_arr[i].trim();

        if (tmp.length)
            arr[j++] = tmp_arr[i];
    }

    let num = parseInt(arr[1]);

    if (arr[0].toLowerCase() != '/' || empty_int(num) || arr.length > 3)
        return ;
    
    if (arr.length > 2 && arr[2])
    {
        stat = parseInt(arr[2]);

        if (empty_int(stat) || num < 1 || num > 2)   
            return ;
    }

    if (stat)
    {
        connection.query("SELECT * FROM from_chat WHERE is_static=1", function (error, result)
        {
    
            if (error)                      
                throw error;
            if (!result || !result[0])
                return ;
    
            let buffer = ['status', 'invoice'];

            if (result[num - 1].active)
            {
                http_request(php_server + "?token=" + token + "&value=" + stat + "&needle=" + buffer[num - 1], { json: true }, (err, res, body) =>
                {
                    if (err || !body.success)
                        return ;
                    send_message(dialog_id, body.word);
                    return ;
                });
            }
       });
    }
    else
    {
        connection.query("SELECT * FROM from_chat WHERE is_static IS NULL", function (error, result)
        {
            if (error)
                throw error;
            if (!result || !result[0])
                return ;
    
            if (num - 2 == result.length + 1)
            {
                to_manager(dialog_id, last_dialog);
            }
            else
            {
                if (num - 2 > result.length + 1 || !result[num - 3]['answer'])
                    return ;
                send_message(dialog_id, result[num - 3]['answer']);
                return ;
            }
       });
    }
}

function to_manager (char_id, dialog_id)
{
    api.getUsers({online: true, active: true})
    .then(function (result)
    {
        if (!result.length)
        {
            send_message(char_id, "К сожалению, сейчас все менеджеры заняты :( Вам ответят в ближайшее время!");
        }
        else
        {
            switch_dialog(dialog_id, { dialog_id: dialog_id, user_id: result[0].id });
            send_message(char_id, "Успешно! Менеджер ответит вам в ближайшее время :)");
        }
    })
    .catch(function (e) {
        console.log(e);
    });
}


const wsData = api.getWebsocketData([MgBotApiClient.types().wsMessageNew, MgBotApiClient.types().wsChatCreated]);
const ws = new WebSocket(wsData.get('url'), {
    headers: wsData.get('headers')
});

ws.on('message', function (content) {
    let event = JSON.parse(content);

    // if (event.type == 'chat_created')
    // {
    //     init_first_message(event.data.chat.id);
    //     return ;
    // }
    let data = event.data.message;
    if (event.type == 'message_new' && data && data.from && data.from.type != 'bot' && data.from.type != 'user')
    {
        message_handler(data.content, data.chat.id, data.chat.last_dialog.id);
    }
});


server.listen(3001, "127.0.0.1");
