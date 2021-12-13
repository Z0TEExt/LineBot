const { google } = require("googleapis");
const line = require('@line/bot-sdk');
const express = require('express');
const dotenv = require('dotenv');
const message = require('./message.json');

// config env และ package
const env = dotenv.config().parsed
const app = express()

const lineConfig = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET || env.CHANNEL_SECRET
}

const client = new line.Client(lineConfig);

// Setting ส่วนของ Google
const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: "https://www.googleapis.com/auth/spreadsheets"
});

// ฟังชั่นหลัก
app.post('/webhook', line.middleware(lineConfig), async (req, res, next) => {
    try {
        const events = req.body.events
        console.log('event', events);
        events.length > 0 ? await events.map(item => handleEvent(item)) : res.status(200).send("OK")

        if (req.session.user) return next();
        return next(new NotAuthorizedError());
    } catch (e) {
        res.status(500).end()
    }
});

//คำสั่งเรียกใช้งาน 
const prefix = '!';

// ตัวแปลไว้เก็บข้อความแบบ Global
let replyLineMessage
let confirm = 0;

// ฟังชั่นรอง
const handleEvent = async (event) => {

    // ส่วนของ Google
    const authclient = await auth.getClient();
    const googleSheets = google.sheets({version: "v4", auth: authclient });

    // ID ของ Google Sheet
    const spreadsheetId = "1TFMBHX19EVQWgTZIruszDxIlXo5r1Oj4LYsQQTcutlM";

    // get ค่าแถวของ GS
    const getRows = await googleSheets.spreadsheets.values.get({auth, spreadsheetId, range: "data1"});

    console.log(confirm);

    // เช็คข้อมูลว่าเป็น message หรือเปล่า
    if(event.type !== 'message' || event.message.type !== 'text') return null;
    
    // เริ่มทำงานในโต้ตอบ
    else if (event.message.text.startsWith(prefix)) {   

        // คำสั่งเรียกใช้งาน 
        const args = event.message.text.trim().split(/ +/g);
        const cmd = args[0].slice(prefix.length).toLowerCase();       

        // ตัวแปลเก็บข้อมูลจาก GS และ เก็บค่าเช็ค
        let x, y, sheet
        let checkitem = true;

        // เช็คข้อมูลว่าตรงกับ GS หรือเปล่า
        for (var i=1;i<getRows.data.values.length; i++){
            if(getRows.data.values[i][0] != args[1]) {
                // เช็คว่ามีข้อมูลอยู่หรือเปล่า
                checkitem = false;    
            }
        }

        for (var i=1;i<getRows.data.values.length; i++){
            if(getRows.data.values[i][0] == args[1]) {
                x = getRows.data.values[i][1]
                y = getRows.data.values[i][2]
                checkitem = true; 
                sheet = i;
            }
        }
        
        // ส่งข้อมูลไปเก็บไว้ใน ไฟล์ JSON
        let num1 = 1;
        let num2 = 0;
        for (var i = 0; i < 5; i++) {
            num1+=1
            num2+=1
            message.msg1.contents.contents[0].body.contents[3].contents[num1].contents[0].text = getRows.data.values[num2][0];
            message.msg1.contents.contents[0].body.contents[3].contents[num1].contents[1].text = getRows.data.values[num2][1];
            message.msg1.contents.contents[0].body.contents[3].contents[num1].contents[2].text = getRows.data.values[num2][2];
        }
        for (var i = 0; i < 4; i++) {
            num2+=1
            message.msg1.contents.contents[1].body.contents[3].contents[i].contents[0].text = getRows.data.values[num2][0];
            message.msg1.contents.contents[1].body.contents[3].contents[i].contents[1].text = getRows.data.values[num2][1];
            message.msg1.contents.contents[1].body.contents[3].contents[i].contents[2].text = getRows.data.values[num2][2];
        }

        message.msg2.contents.body.contents[1].text = args[1];
        message.msg2.contents.body.contents[3].contents[0].contents[1].text = x;
        message.msg2.contents.body.contents[3].contents[1].contents[1].text = y;

        // เริ่มคำสั่ง
        switch (cmd){
            case "stock": 
                replyLineMessage = message.msg1
                break
            case "ckst":
                if (args[1] == null) {
                    replyLineMessage = {"type": "text", "text": "โปรดกรอกข้อมูลที่ต้องการค้นหาครับ"}
                    break
                }
                if (checkitem != true) replyLineMessage = {"type": "text", "text": "ไม่พบข้อมูลที่ต้องการตรวจสอบครับ" }
                else replyLineMessage = message.msg2
                break
            case "adst":
                if (checkitem == true){
                    if (args[1] == null){
                        replyLineMessage = {"type": "text", "text": "โปรดกรอกข้อมูลที่ต้องการอัพเดท ตัวอย่างเช่น !adst ชื่อสินค้า จำนวน ราคา"}
                        break
                    }else if (args[2] == null) {
                        replyLineMessage = {"type": "text", "text": "โปรดกรอก จำนวน สินค้า ตัวอย่างเช่น !adst ชื่อสินค้า จำนวน ราคา"}
                        break
                    }else if (args[3] == null) {
                        replyLineMessage = {"type": "text", "text": "โปรดกรอก ราคา สินค้า ตัวอย่างเช่น !adst ชื่อสินค้า จำนวน ราคา"}
                        break
                    }
                    let updatedata = parseInt(args[2])+parseInt(x);
                    // อัพเดทข้อมูลลงแถวของ GS
                    await googleSheets.spreadsheets.values.update(
                        {auth, spreadsheetId, range: `data1!A${sheet+1}:C${sheet+1}`, valueInputOption: "USER_ENTERED", 
                        resource:{range: `data1!A${sheet+1}:C${sheet+1}`, majorDimension: "ROWS", values: [[`${args[1]}`, `${updatedata}`, `${args[3]}`]] }
                    });
    
                    replyLineMessage = {"type": "text", "text": "อัพเดทข้อมูลเรียบร้อยแล้วค้าบบบ" }
                    break
                } else {
                    if (args[1] == null){
                        replyLineMessage = {"type": "text", "text": "โปรดกรอกข้อมูลที่ต้องการเพิ่ม ตัวอย่างเช่น !adst ชื่อสินค้า จำนวน ราคา"}
                        break
                    }else if (args[2] == null) {
                        replyLineMessage = {"type": "text", "text": "โปรดกรอก จำนวน สินค้า ตัวอย่างเช่น !adst ชื่อสินค้า จำนวน ราคา"}
                        break
                    }else if (args[3] == null) {
                        replyLineMessage = {"type": "text", "text": "โปรดกรอก ราคา สินค้า ตัวอย่างเช่น !adst ชื่อสินค้า จำนวน ราคา"}
                        break
                    }
                    confirm = 1;
                    message.adddata.data1 = args[1];
                    message.adddata.data2 = args[2];
                    message.adddata.data3 = args[3];
                    replyLineMessage = {"type": "text", "text": "ต้องการที่จะเพิ่มข้อมูลใหม่ใช่หรือไม่? (หากมีข้อมูลอยู่แล้วอาจทำให้ซ้ำกับอันเก่าได้)\nโปรดพิม ใช่/Y หรือ ไม่/N" }
                    break
                }
            case "help":
                replyLineMessage = message.msg3
                break
            default:
                replyLineMessage = {"type": "text", "text": "ไม่พบคำสั่ง โปรดลองพิม !help เพื่อดูคำสั่งครับ"}
                break
        }

        // ส่งข้อมูลกลับไปยังฟังชั่นหลัก
        return client.replyMessage(event.replyToken, replyLineMessage);

    // พิมหาบอทที่ไม่ใช่ command
    } else {

        //array คำที่ผู้ใช้งานพิมจะตอบกลับเป็นข้อความแบบสุ่ม
        let usermsg = ["มี", "ใช่"]
        let replymsgX = ["ต้องการใช้งานบอทหรอครับ? (โปรดพิม ใช่ ถ้าต้องการใช้งานครับ)", "มีอะไรให้ช่วยไหมครับ >_< (โปรดพิม มี ถ้าต้องการใช้งานครับ)"]
        let replymsgY = ["โปรดพิม !help ครับ", "พิม !help ดูสิ!", "พิม !help เพื่อดูคำสั่งครับ"]

        for (var i=0; i < usermsg.length; i++) {
            if (!event.message.text.includes(usermsg[i])) check = false;
        }

        for (var i=0; i < usermsg.length; i++) {
            if (event.message.text.includes(usermsg[i])) check = true;  
        }

        if (confirm == 1 && event.message.text == "ใช่" || event.message.text == "Y") {
            // เพิ่มข้อมูลลงแถวของ GS
            await googleSheets.spreadsheets.values.append({auth, spreadsheetId, range: "data1!A:C", valueInputOption: "USER_ENTERED",
            resource: {
                    values: [[message.adddata.data1, message.adddata.data2, message.adddata.data3]]
                }
            });
            confirm = 0;
            return client.replyMessage(event.replyToken, {"type": "text", "text": "เพิ่มสินค้าลงในคลังเรียบร้อยแล้วค้าบ >_<"});
            
        } else if (confirm == 1 && event.message.text == "ไม่" || event.message.text == "N"){
            confirm = 0;
            return client.replyMessage(event.replyToken, {"type": "text", "text": "ยกเลิกการเพิ่มข้อมูลใหม่เรียบร้อยแล้ว!"});

        }

        if (check == false) {
            switch (event.message.text) {
                case "สีเหลือง" :
                    replyLineMessage = {"type": "text", "text": "Yellow!"};
                    break
                case "มะม่วง" :
                    replyLineMessage = {"type": "text", "text": "Mango!"};
                    break
                 case "ห้ะ" :
                    replyLineMessage = {"type": "text", "text": "ห้ะ!"};
                    break
                default :
                    replyLineMessage = {"type": "text", "text": replymsgX[Math.floor(Math.random()*replymsgX.length)] };
                    break
            }  
        } else replyLineMessage = {"type": "text", "text": replymsgY[Math.floor(Math.random()*replymsgY.length)] };

        return client.replyMessage(event.replyToken, replyLineMessage);
    }
}
const PORT = process.env.PORT || 3000;

//รันบน localhost

// app.listen(4000, () => {
//     console.log(`listening on 4000`);
// });

// รันบน server

app.listen(PORT, () => {
    console.log(PORT);
    console.log(`listening on Port ${PORT}`);
});