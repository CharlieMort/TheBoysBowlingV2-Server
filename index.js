const mysql = require("mysql");
const express =  require("express");
const app = express();
const cors = require("cors");
const PORT = process.env.PORT | 8000;

app.use(express.json());
app.use(cors());

const connection = mysql.createConnection({
    host: "localhost",
    user: "gerald",
    password: "password",
    database: "BoysBowlingDB"
});

connection.connect();

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
    connection.query(`SELECT * FROM players ORDER BY totalScore DESC;`, (err, rows) => {
        if (err) throw err;
        console.log(rows);
        res.send(rows);
    })
});

// Get Single Player Based On Given ID
app.get("/players/:id", (req, res) => {
    connection.query(`SELECT * FROM players WHERE ID = ${req.params.id};`, (err, rows) => {
        if (err) throw err;
        console.log(rows);
        res.send(rows);
    })
});

app.post("/players/add", (req, res) => {
    connection.query(`INSERT INTO players (name) VALUES ("${req.body.name}");`, (err, result) => {
        if (err) throw err;
        console.log("Inserted Into Players Success");
        res.send("Success");
    });
})

app.get("/players/scores/:id", (req, res) => {
    connection.query(`SELECT * FROM scores WHERE playerID = ${req.params.id};`, (err, rows) => {
        if (err) throw err;
        console.log(rows);
        res.send(rows);
    })
})

app.get("/players/scores/name/:name", (req, res) => {
    connection.query(`SELECT scores.* FROM scores INNER JOIN players ON players.ID = scores.playerID WHERE players.name = "${req.params.name}"`, (err, rows) => {
        if (err) throw err;
        console.log(rows);
        res.send(rows);
    })
})

// Get All Scores
app.get("/scores", (req, res) => {
    connection.query(`SELECT * FROM scores ORDER BY totalScore DESC;`, (err, rows) => {
        if (err) throw err;
        console.log(rows);
        res.send(rows);
    })
});

app.get("/scores/name", (req, res) => {
    connection.query(`SELECT scores.*, players.name FROM scores INNER JOIN players ON scores.playerID = players.ID ORDER BY scores.totalScore DESC;`, (err, rows) => {
        if (err) throw err;
        console.log(rows);
        res.send(rows);
    })
})

app.post("/scores/add", (req, res) => {
    let total = calculateBowl(req.body.scoreString);
    let nameID = -1;
    if (req.body.playerName != undefined) {
        connection.query(`SELECT ID FROM players WHERE name = "${req.body.playerName}";`, (err, nameResult) => {
            nameID = parseInt(nameResult[0]);
            console.log(nameResult);
            connection.query(`
                INSERT INTO scores (playerID, scoreString, totalScore, datePlayed, seasonNum, gameNum)
                VALUES (${nameID}, "${req.body.scoreString}", ${total}, "${req.body.datePlayed}", ${req.body.seasonNum}, ${req.body.gameNum});
            `, (err, result) => {
                if (err) throw err;
                console.log("Inserted Score Success");
                res.send("Added Score");
            })
        })
    }
    else {
        nameID = req.body.playerID;
        connection.query(`
            INSERT INTO scores (playerID, scoreString, totalScore, datePlayed, seasonNum, gameNum)
            VALUES (${nameID}, "${req.body.scoreString}", ${total}, "${req.body.datePlayed}", ${req.body.seasonNum}, ${req.body.gameNum});
        `, (err, result) => {
            if (err) throw err;
            console.log("Inserted Score Success");
            res.send("Added Score");
        })
    }
    connection.query(`UPDATE players SET totalScore = totalScore + ${total};`, (err, out) => {
        if (err) throw err;
    });
})

// Get Single ScoreCard Based On Given ID
app.get("/scores/:id", (req, res) => {
    connection.query(`SELECT * FROM scores WHERE ID = ${req.params.id};`, (err, rows) => {
        if (err) throw err;
        console.log(rows);
        res.send(rows);
    });
});



app.listen(PORT, () => {
    console.log(`Server Listening On Port:${PORT}`);
})