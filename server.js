'use strict';
const sql =  require('sqlite3');
const fs = require('fs');
const express = require('express');
const bodyparser = require('body-parser');
const morgan = require('morgan');

var router = express.Router();
var jsonparser = bodyparser.json();
var serverapi = express();


var datadir = './Data';

if(! fs.existsSync(datadir)){
    fs.mkdirSync(datadir);
}

var db = new sql.Database(datadir += '/database.db');

function main(){
    
    initDB();

    
    router.use(jsonparser);
    router.route('/').get((req,res) => res.status(200).send("Main Page of API"));
 

  router.route('/note')
        .get((req, res) => {
            wholenotesoutofdb((err,result) => {
                if(err){
                    logError(err);
                    throw err;
                }
                res.status(200).send(result);
            })
        })
        .post((req, res) => {
            var rqk = req.body.noteid;
            var rqv = req.body.message;
			console.log("k:"+rqk+" v:"+rqv);
			console.log(req.originalUrl); // '/admin/new'
			console.log(req.body); // '/new'
            if(rqk != undefined && rqv == undefined){
                insertintodbwithid(rqk);
                res.json({"noteid": rqk, "message": ""});
                
            }
            else if((rqk == undefined || rqk == 0) && rqv != undefined){
                insertintodbwithtext(rqv);
                lastinsertedintodb((err,result) => {
                    res.json({"noteid": result , "message": rqv});
                })

                
            } 
            else if (rqk != undefined && rqv != undefined){
                insertintodbwithidandtext(rqk,rqv);
                res.json({"noteid": rqk, "message": rqv});
            }
            else{
                logError("Fehler nicht ausführbar, noteid und message fehlen!");
                res.send("ERROR");
            }
            
            
            

        })

    router.route('/note/:id')
        .get((req,res) => {
            searchintodb(req.params.id,(err,result,wid) => {
                if(err){
                    logError(err)
                    throw err;
                }
                //result.links.push({"this": req.originalUrl , "author": "/api/writer/" + wid});
                res.send(JSON.stringify(result));
            })
        })
        .put((req,res) =>{
			console.log("Parameter bei put:"+req.params.id);
            searchintodb(req.params.id, (err,result) =>{
                if(result != "[]"){
					console.log("RBNoteid: "+ req.body.noteid +" RBMessage: "+req.body.message);
                    if(req.body.noteid == undefined && req.body.message != undefined){
						console.log("PUT, path 1");
                        db.serialize(() => {
                            db.run(`UPDATE notes set message = '${req.body.message}' where noteid = ${req.params.id}`);
                        })
                        res.json({"noteid": req.params.id, "message": req.body.message});
                    }
                    else if(req.body.noteid != undefined && req.body.message != undefined){
						console.log("PUT, path 2");
                        updateidinandtextindb(req.params.id,req.body.noteid,req.body.message);
                        res.json({"noteid": req.body.noteid, "message": req.body.message});
                    }
                    else if(req.body.noteid != undefined && req.body.message == undefined){
                        						console.log("PUT, path 3");
							updateidindb(req.params.id,req.body.noteid, (err,result) => {
                            res.json({"noteid": req.body.noteid});
                        })
                    }
                    else{
												console.log("PUT, path 4");

                        logError(err);
                        throw err;
                    }
                }
                else{
                    if(req.params.id != undefined && req.body.message == undefined){
                        insertintodbwithid(req.params.id);
                        res.json({"noteid": req.params.id, "message": ""});
                        
                    }
                    else if (req.params.id != undefined && req.body.message != undefined){
                        insertintodbwithidandtext(req.params.id,req.body.message);
                        res.json({"noteid": req.params.id, "message": req.body.message});
                    }
                    else{
                        logError("Fehler nicht ausführbar, noteid und message fehlen!");
                        res.send("ERROR");
                    }
                }
            })

        })
                
    
        .delete((req, res) => {
            deletefromdb(req.params.id,(err,result) => {
                if(err){
                    res.send(result);
                }
                res.send(result);
            })
        })
    
    router.route('/note/lastid')
        .get((req,res) => {
            lastinsertedintodb((err,result) =>{
               res.send(`${result}`); 
            })
            
        })
   

    
    serverapi.use(morgan('dev'));
    serverapi.use('/api/', router);
    serverapi.listen(3000, () => console.log("Listening on Port: 3000"));
    
}
function initDB(){
    
    db.serialize(() => {
        db.run("Create Table if not exists notes (noteid INTEGER PRIMARY KEY, message Text)");
        db.run("INSERT OR IGNORE INTO notes(noteid,message) Values (1,'Note one')");
        db.run("INSERT OR IGNORE INTO notes(noteid,message) Values (2,'Note two')");
        db.run("INSERT OR IGNORE INTO notes(noteid,message) Values (3,'and the third note')");
 
    })

}

function updateidinandtextindb(idold,idnew,txt){
    
    db.serialize(() => {
        db.run(`UPDATE notes set noteid =${idnew}, message = '${txt}' where noteid =${idold}`);
    })
}
function updatetextindb(id,txt){

    db.serialize(() => {
        db.run(`UPDATE notes set message = '${txt}' where noteid = ${id}`);
    })
    
}
function updateidindb(idold,idnew,callback){

    db.serialize(() => {
        db.run(`UPDATE notes set noteid =${idnew} where noteid =${idold}`);
        db.get("SELECT last_insert_rowid() 'message'", (err,row) => {
            if(err){
                logError(err);
                throw err;
            }
            callback(null, row.message);
        })
    })
}
function lastinsertedintodb(callback){
    
    db.serialize(() => {
        db.get("SELECT last_insert_rowid() 'noteid'",(err,row) => {
            if(err){
                logError(err);
                throw err;
            }
            callback(null, row.noteid);
        });
    });
}

function insertintodbwithidandtext(idofnote,txt){
    db.serialize(() => {
        db.run(`INSERT INTO notes(noteid,message) Values (${idofnote},'${txt}')`);
    })
}
function insertintodbwithid(idofnote){
    db.serialize(() => {
        db.run(`INSERT INTO notes(noteid,message) Values (${idofnote},' ')`);
    })
}
function insertintodbwithtext(txt){

    db.serialize(() => {
        db.run(`Insert INTO notes (message) Values ('${txt}')`)
    })
}

function searchintodb(id, callback){

    var query = `Select * from notes where noteid = ${id}`;

    db.serialize(() => {
        db.all(query, (err, row) =>{
            callback(err, JSON.stringify(row));
              
        })
    })
    
}


function deletefromdb(id,callback){
    
    searchintodb(id,(err,result) => {
        if(err){
            callback(err,result);
        }
        else{
            callback(null,result);
            db.serialize(() => {
                db.run(`DELETE FROM notes where noteid = ${id}`);
            })
        }
    })
    
}

function wholenotesoutofdb(callback){

    var query = "Select * from notes";

    db.serialize(() => {
        db.all(query, (err, row) => {
            callback(err, JSON.stringify(row));
        })
    })
}


function logError(err){
    console.log(err);
}



main();

