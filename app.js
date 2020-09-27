const express = require('express')
const app = express()
const port = 3000

var db = require('quick.db')

const pocketConsumerKey = ''
const pocketRedirectUri = 'http://localhost:3000/redirect'

var GetPocket = require('node-getpocket');
var config = {
    consumer_key: pocketConsumerKey,
    redirect_uri: pocketRedirectUri
};
var pocket = new GetPocket(config);

function getRequestToken(res) {
    var params = {
        redirect_uri: config.redirect_uri
    };
    pocket.getRequestToken(params, function(err, resp, body) {
        if (err) {
            console.log('Oops; getTokenRequest failed: ' + err);
        }
        else {
            var json = JSON.parse(body);
            var request_token = json.code;
            console.log(json);
            db.set('request_token', request_token)
            getRedirectUrl(request_token, res);
        }
    });
}

function getRedirectUrl(requestToken, res){
    var config = {
        consumer_key: pocketConsumerKey,
        request_token: requestToken,
        redirect_uri: pocketRedirectUri
    };
    var url = pocket.getAuthorizeURL(config);
    res.redirect(url);
}

app.get('/', (req, res) => {
    getRequestToken(res);
})

app.get('/redirect', (req, res) => {
    var params = {
        request_token: db.get('request_token')
    };
    pocket.getAccessToken(params, function(err, resp, body) {
        db.delete('request_token');
        if (err) {
            console.log('Oops, getTokenRequest failed: ' + err);
        }
        else {
            var json = JSON.parse(body);
            var access_token = json.access_token;
            db.delete('access_token');
            db.set('access_token', access_token)
        }
    });

    res.redirect("/show");
})

app.get('/show', (req, res) => {
    let accessToken = db.get('access_token');
    if(accessToken) {
        res.send(accessToken);
    } else {
        res.send('access_token not found');
    }
})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})
