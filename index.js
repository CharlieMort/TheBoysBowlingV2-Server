const mysql = require("mysql2");
const express =  require("express");
const http = require("http");
const https = require("https");
const fs =  require("fs");
const app = express();
const cors = require("cors");
const PORT = process.env.PORT | 8000;

app.use(express.json());
app.use(cors());

const dev = true;
let certificate = {};
if (!dev) {
    const privateKey = fs.readFileSync("/etc/letsencrypt/live/theboysbowling.co.uk/privkey.pem", "utf-8");
    const certificate = fs.readFileSync("/etc/letsencrypt/live/theboysbowling.co.uk/cert.pem", "utf-8");
    const ca = fs.readFileSync("/etc/letsencrypt/live/theboysbowling.co.uk/chain.pem", "utf-8");

    credentials = {
        key: privateKey,
        cert: certificate,
        ca: ca
    }
}

const connection = mysql.createPool({
    connectionLimit: 10,
    host: "localhost",
    user: "gerald",
    password: "password",
    database: "BoysBowlingDB"
});

// connection.connect((err) => {
//     if (err) throw err;
// });

function getValueForBowl(bowl) {
    let bowls = bowl.split("");
    let score = 0;
    for (let i = 0; i<bowls.length; i++) {
        let num = parseInt(bowls[i]);
        if (num) {
            score += num;
        }
        else {
            if (bowls[i] == "/") {
                score = 10;
            }
            else if (bowls[i] == "X") {
                score += 10;
            }
        }
    }
    return score;
}

function calculateBowl(scoreCard) {
    let scores = scoreCard.split(".");
    let score = 0;
    for (let i = 0; i<scores.length; i++) {
        if (scores[i].length === 3) {
            score += getValueForBowl(scores[i]);
        }
        else if (scores[i][0] == "X") {
            score += 10;
            score += getValueForBowl(scores[i+1]);
            if (scores[i+1] == "X-") {
                score += getValueForBowl(scores[i+2][0]);
            }
            else if (scores[i+1] == "XXX") {
                score -= 10;
            }
        }
        else if (scores[i][1] === "/") {
            score += 10;
            if (i+1 < scores.length) {
                score += getValueForBowl(scores[i+1][0]);
            }
        }
        else {
            score += getValueForBowl(scores[i]);
        }
    }
    return score;
}

// Get All Players
app.get("/players", (req, res) => {
    console.log(req.headers['x-forwarded-for'] || req.socket.remoteAddress );
    connection.query(`SELECT * FROM players ORDER BY totalScore DESC;`, (err, rows) => {
        if (err) throw err;
        res.send(rows);
    })
});

// Get Single Player Based On Given ID
app.get("/players/:id", (req, res) => {
    connection.query(`SELECT * FROM players WHERE ID = ${req.params.id};`, (err, rows) => {
        if (err) throw err;
        res.send(rows);
    })
});

app.post("/players/add", (req, res) => {
    connection.query(`INSERT INTO players (name) VALUES ("${req.body.name}");`, (err, result) => {
        if (err) throw err;
        res.send("Success");
    });
})

app.get("/players/scores/:id", (req, res) => {
    connection.query(`SELECT * FROM scores WHERE playerID = ${req.params.id};`, (err, rows) => {
        if (err) throw err;
        res.send(rows);
    })
})

app.get("/players/scores/name/:name", (req, res) => {
    connection.query(`SELECT scores.* FROM scores INNER JOIN players ON players.ID = scores.playerID WHERE players.name = "${req.params.name}"`, (err, rows) => {
        if (err) throw err;
        res.send(rows);
    })
})

// Get All Scores
app.get("/scores", (req, res) => {
    connection.query(`SELECT * FROM scores ORDER BY score DESC;`, (err, rows) => {
        if (err) throw err;
        res.send(rows);
    })
});

app.get("/scores/name", (req, res) => {
    connection.query(`SELECT scores.*, players.name FROM scores INNER JOIN players ON scores.playerID = players.ID ORDER BY scores.score DESC;`, (err, rows) => {
        if (err) throw err;
        res.send(rows);
    })
})

app.post("/scores/add", (req, res) => {
    let total = calculateBowl(req.body.scoreString);
    let nameID = -1;
    if (req.body.playerName != undefined) {
        connection.query(`SELECT ID FROM players WHERE name = "${req.body.playerName}";`, (err, nameResult) => {
            nameID = nameResult[0].ID;
            connection.query(`
                INSERT INTO scores (playerID, scoreCard, score, datePlayed, seasonNum, gameNum)
                VALUES (${nameID}, "${req.body.scoreString}", ${total}, "${req.body.datePlayed}", ${req.body.seasonNum}, ${req.body.gameNum});
            `, (err, result) => {
                if (err) throw err;
                res.send("Added Score");
            })
            connection.query(`UPDATE players SET totalScore = totalScore + ${total} WHERE ID = ${nameID};`, (err, out) => {
                if (err) throw err;
            });
        })
    }
    else {
        nameID = req.body.playerID;
        connection.query(`
            INSERT INTO scores (playerID, scoreCard, score, datePlayed, seasonNum, gameNum)
            VALUES (${nameID}, "${req.body.scoreString}", ${total}, "${req.body.datePlayed}", ${req.body.seasonNum}, ${req.body.gameNum});
        `, (err, result) => {
            if (err) throw err;
            res.send("Added Score");
            connection.query(`UPDATE players SET totalScore = totalScore + ${total} WHERE ID = ${nameID};`, (err, out) => {
                if (err) throw err;
            });
        })
    }
    
})

// Get Single ScoreCard Based On Given ID
app.get("/scores/:id", (req, res) => {
    connection.query(`SELECT * FROM scores WHERE ID = ${req.params.id};`, (err, rows) => {
        if (err) throw err;
        res.send(rows);
    });
});

app.get("/bowls-thrown" , (req, res) => {
    connection.query(`SELECT scoreCard FROM scores;`, (err, rows) => {
        if (err) throw err;
        let total = 0;
        rows.map((scoreCard) => {
            scoreCard = scoreCard.scoreCard.split(".");
            total += scoreCard.length;
        })
        res.send({total:total});
    })
})

function getTop3(players) {
    let out = [{name:"N/A", total:0},{name:"N/A", total:0},{name:"N/A", total:0}];
    for(let player in players) {
        if (players[player] > out[0].total) {
            out[1].name = out[0].name;
            out[1].total = out[0].total;
            out[0].name = player;
            out[0].total = players[player];
        }
        else if (players[player] > out[1].total) {
            out[2].name = out[1].name;
            out[2].total = out[1].total;
            out[1].name = player;
            out[1].total = players[player];
        }
        else if (players[player] > out[2].total) {
            out[2].name = player;
            out[2].total = players[player];
        }
    }
    return out;
}

app.get("/strikes/rank", (req, res) => {
    connection.query(`SELECT players.name, scores.scoreCard FROM scores INNER JOIN players ON players.ID = scores.playerID;`, (err, rows) => {
        if (err) throw err;
        let players = {};
        rows.map((row) => {
            if (players[row.name] == undefined) players[row.name] = 0;
            let row2 = row.scoreCard.split(".");
            row2.map((bowl) => {
                if (bowl == "X") players[row.name] ++;
            })
        })
        res.send(getTop3(players));
    })
})

app.get("/spares/rank", (req, res) => {
    connection.query(`SELECT players.name, scores.scoreCard FROM scores INNER JOIN players ON players.ID = scores.playerID;`, (err, rows) => {
        if (err) throw err;
        let players = {};
        rows.map((row) => {
            if (players[row.name] == undefined) players[row.name] = 0;
            let row2 = row.scoreCard.split(".");
            row2.map((bowl) => {
                if (bowl.length > 1) {
                    if (bowl[1] == "/") players[row.name] ++;
                }
            });
        })
        res.send(getTop3(players));
    })
})

app.get("/gutters/rank", (req, res) => {
    connection.query(`SELECT players.name, scores.scoreCard FROM scores INNER JOIN players ON players.ID = scores.playerID;`, (err, rows) => {
        if (err) throw err;
        let players = {};
        rows.map((row) => {
            if (players[row.name] == undefined) players[row.name] = 0;
            let row2 = row.scoreCard.split(".");
            row2.map((bowl) => {
                if (bowl.length > 1) {
                    if (bowl[0] == "-") players[row.name] ++;
                    if (bowl[1] == "-") players[row.name] ++;
                    if (bowl.length > 2) if (bowl[2] == "-") players[row.name] ++;
                }
            });
        })
        res.send(getTop3(players));
    })
})

app.get("/strikes", (req, res) => {
    connection.query(`SELECT scoreCard FROM scores;`, (err, rows) => {
        if (err) throw err;
        let total = 0;
        rows.map((scoreCard) => {
            scoreCard = scoreCard.scoreCard.split(".");
            scoreCard.map((bowl) => {
                if (bowl == "X") total ++;
            })
        })
        res.send({total:total});
    })
})

app.get("/spares", (req, res) => {
    connection.query(`SELECT scoreCard FROM scores;`, (err, rows) => {
        if (err) throw err;
        let total = 0;
        rows.map((scoreCard) => {
            scoreCard = scoreCard.scoreCard.split(".");
            scoreCard.map((bowl) => {
                if (bowl.length > 1) {
                    if (bowl[1] == "/") total ++;
                }
            });
        })
        res.send({total: total});
    });
})

app.get("/gutters", (req, res) => {
    connection.query(`SELECT scoreCard FROM scores;`, (err, rows) => {
        if (err) throw err;
        let total = 0;
        rows.map((scoreCard) => {
            scoreCard = scoreCard.scoreCard.split(".");
            scoreCard.map((bowl) => {
                if (bowl.length > 1) {
                    if (bowl[0] == "-") total ++;
                    if (bowl[1] == "-") total ++;
                }
            });
        })
        res.send({total: total});
    });
})

app.get("/best-games", (req, res) => {
    connection.query(`SELECT players.name, scores.score FROM scores INNER JOIN players ON players.ID = scores.playerID ORDER BY scores.score DESC LIMIT 3;`, (err, rows) => {
        if (err) throw err;
        res.send(rows);
    })
})

app.get("/worst-games", (req, res) => {
    connection.query(`SELECT players.name, scores.score FROM scores INNER JOIN players ON players.ID = scores.playerID ORDER BY scores.score ASC LIMIT 3;`, (err, rows) => {
        if (err) throw err;
        res.send(rows);
    })
})

if (dev) {
    const httpServer = http.createServer(app);
    httpServer.listen(PORT, () => {
        console.log(`HTTP server listening on port: ${PORT}`);
    })
}
else {
    const httpsServer= https.createServer(credentials, app);
    httpsServer.listen(PORT, () => {
        console.log(`HTTPS server listening on port: ${PORT}`);
    })
}