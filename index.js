const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');

const api = require('./api');

const port = process.env.PORT || '3000';
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'dist')));

app.use('/api', api);

app.get('', (req, res) => {
    res.send('OK!');
});

app.set('port', port);
const server = http.createServer(app);

function generateRoom() {
    var length = 5;
    var room = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    for (var i = 0; i < length; i++) {
        room += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    while (true) {
        if (!rooms[room]) {
            return room;
        }
    }
}

var rooms = { };
var maxPlayers = 12;
var minPlayers = 1;

var io = require('socket.io')(server);

io.sockets.on('connection', (socket) => {
    let curPlayer;
    let curRoom;
    let minutes = 8; // default time

    var timer;

    socket.on('game-start', (gameInfo) => {
        if (rooms[curRoom].length < minPlayers) {
            return socket.emit('insufficient-players', true);
        } 
        socket.emit('insufficient-players', false);

        var time = minutes * 60;

        timer = setInterval(() => {
            io.in(curRoom).emit('time-count', time);
            time--;

            if (time == -2) {
                clearInterval(timer);
                io.in(curRoom).emit('game-over', true);
            }
        }, 1000);


        let players = rooms[curRoom];

        io.in(curRoom).emit('game-info', { players: players, info: gameInfo });
        socket.broadcast.to(curRoom).emit('starting-game');
    });

    socket.on('end-game', () => {
        console.log('end game');
        clearInterval(timer);
        io.in(curRoom).emit('game-over', true);
    });

    socket.on('create-room', () => {
        console.log('creating new room');
        
        let room = generateRoom();

        socket.join(room);
        rooms[room] = [];

        socket.emit('room-created', room);
    });

    socket.on('leave-room', (data) => {
        if (curPlayer && curRoom) {

            console.log(`${curPlayer} left room ${curRoom}`);
            socket.leave(curRoom);
            socket.disconnect(true);

            const index = rooms[curRoom].indexOf(curPlayer); // index of name
            if (index !== -1) {
                rooms[curRoom].splice(index, 1);
            }

            io.in(curRoom).emit('player-left', { players: rooms[curRoom] });

            if (rooms[curRoom].length === 0) {
                console.log(`${curRoom} is deleted`);
                delete rooms[curRoom];
            }
        }
    });

    socket.on('disconnect', () => {
        if (curPlayer && curRoom) {

            console.log(`${curPlayer} left room ${curRoom}`);
            socket.leave(curRoom);
            socket.disconnect(true);

            const index = rooms[curRoom].indexOf(curPlayer); // index of name
            if (index !== -1) {
                rooms[curRoom].splice(index, 1);
            }

            io.in(curRoom).emit('player-left', { players: rooms[curRoom] });

            if (rooms[curRoom].length === 0) {
                console.log(`${curRoom} is deleted`);
                delete rooms[curRoom];
            }
        }
    });

    socket.on('change-time', (time) => {
        minutes = time;
        io.in(curRoom).emit('update-time', time);
    });

    // data: { roomCode: string, name: string }
    socket.on('join-room', (data) => {
        let room = rooms[data.roomCode];
        if (!room) {
            console.log('room does not exist');
            socket.emit('invalid-room');
            return;
        } else if (room.length === maxPlayers) {
            console.log('room is full');
            socket.emit('full-room');
            return;
        } else if (!data.name) {
            console.log('invalid name');
            socket.emit('invalid-name');
            return;
        } else if (room.includes(data.name)) {
            console.log('player exists');
            socket.emit('existing-player');
            return;
        }

        curPlayer = data.name;
        curRoom = data.roomCode;
        console.log(`${data.name} joined ${data.roomCode}`);
        socket.join(data.roomCode);
        room.push(data.name);
        
        let roomInfo = {
            roomCode: data.roomCode,
            players: room
        };
        
        io.in(data.roomCode).emit('joined-room', roomInfo);
    });
});

server.listen(port, () => {
    console.log(`app listening on port: ${port}`);
});