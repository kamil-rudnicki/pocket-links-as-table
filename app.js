/**
 * todo: refactor!
 */

const express = require('express')
const app = express()

let conf = require('rc')('pocket', {
    port: 3000,
    pocket: {
        consumerKey: '',
        redirectUri: 'http://localhost:3000/redirect',
        params: {
            'state': 'unread',
            'sort': 'newest',
            'detailType': 'complete',
        }
    }
});

const db = require('quick.db')

const pocketConsumerKey = conf.pocket.consumerKey;
const pocketRedirectUri = conf.pocket.redirectUri;

if(pocketConsumerKey == '') {
    throw new Error('Missing consumer key, take a look at readme.md');
}

const GetPocket = require('node-getpocket');

function getRequestToken(res) {
    const config = {
        consumer_key: pocketConsumerKey,
        redirect_uri: pocketRedirectUri
    };
    let pocket = new GetPocket(config);

    const params = {
        redirect_uri: config.redirect_uri
    };
    pocket.getRequestToken(params, function(err, resp, body) {
        if (err) {
            console.log('Oops; getTokenRequest failed: ' + err);
        }
        else {
            const json = JSON.parse(body);
            const request_token = json.code;
            console.log(json);
            db.set('request_token', request_token)
            getRedirectUrl(pocket, request_token, res);
        }
    });
}

function getRedirectUrl(pocket, requestToken, res) {
    const config = {
        consumer_key: pocketConsumerKey,
        request_token: requestToken,
        redirect_uri: pocketRedirectUri
    };
    const url = pocket.getAuthorizeURL(config);
    res.redirect(url);
}

function getRefreshedPocket(accessToken) {
    const config = {
        consumer_key: conf.pocket.consumerKey,
        access_token: accessToken
    };
    return new GetPocket(config);
}

function getPocketArticles(pocket, params, accessToken, onSuccess) {
    pocket.get(params, function(err, resp) {
        if (err) {
            console.log('Oops, get failed: ' + err);
            console.log(params);
            console.log(params);
            console.log(err);
        } else {
            onSuccess(resp.list);
        }
    });
}

app.get('/', (req, res) => {
    const accessToken = db.get('access_token');
    if(accessToken) {
        res.redirect("/show");
    } else {
        getRequestToken(res);
    }
})

app.get('/redirect', (req, res) => {
    const params = {
        request_token: db.get('request_token')
    };
    const config = {
        consumer_key: pocketConsumerKey,
        redirect_uri: pocketRedirectUri
    };
    console.log(config);
    let pocket = new GetPocket(config);
    pocket.getAccessToken(params, function(err, resp, body) {
        if (err || resp.statusCode !== 200) {
            console.log('Oops, getTokenRequest failed: ' + err);
        }
        else {
            const json = JSON.parse(body);
            const access_token = json.access_token;
            console.log(access_token);
            db.delete('access_token');
            db.set('access_token', access_token)
        }
        db.delete('request_token');

        res.redirect("/show");
    });
})

app.get('/show', (req, res) => {
    const accessToken = db.get('access_token');
    if(accessToken) {
        res.send(accessToken);
        getPocketArticles(getRefreshedPocket(accessToken), conf.pocket.params, accessToken, function(items) {
            let html = '<table border="1">';
            let counter = 1;
            for (let key in items) {
                const title = items[key]['resolved_title'];
                const url = items[key]['resolved_url'];
                const readTime = items[key]['time_to_read'];
                const added = items[key]['time_added'];
                let tags = '';
                let tagsString = '';

                if(items[key]['tags']) {
                    for (let tagKey in items[key]['tags']) {
                        tags += `<td>${items[key]['tags'][tagKey]['tag']}</td>`;
                        tagsString += `${items[key]['tags'][tagKey]['tag']},`;
                    }
                }

                html += `<tr>
                                <td>${counter}.</td>
                                <td>${title}</td>
                                <td>${url}</td>
                                <td>${readTime}</td>
                                <td>${added}</td>
                                <td>${tagsString}</td>
                                ${tags}
                            </tr>`;

                counter++;
            }

            res.send(html);
            res.send(accessToken);
            res.send("<pre>" + JSON.stringify(resp.list, null, 4));
        });
    } else {
        res.send('access_token not found, open http://localhost');
    }
})

app.get('/archive_all', (req, res) => {
    const accessToken = db.get('access_token');
    const pocket = getRefreshedPocket(accessToken);
    if(accessToken) {
        getPocketArticles(pocket, conf.pocket.params, accessToken, function(items) {
            for (let key in items) {
                //todo: pocket will ban IP if too many requests are made with 403 forbidden!
                pocket.archive({item_id: key}, function(err, resp) {
                    console.log("Archived: " + key);
                });
            }
        });
    } else {
        res.send('access_token not found, open http://localhost');
    }
})

app.listen(conf.port, () => {
    console.log(`Example app listening at http://localhost:${conf.port}`)
})
