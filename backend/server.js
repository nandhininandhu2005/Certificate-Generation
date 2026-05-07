import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import Certificate from './models/Certificate.js';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const CERT_DIR = path.join(__dirname, 'generated-certificates');
const FONT_PATH = path.join(__dirname, 'fonts', 'times-new-roman.ttf');
const BOLD_FONT_PATH = path.join(__dirname, 'fonts', 'times-new-roman-bold.ttf');
const BG_PATH = path.join(__dirname, 'assets', 'letterpad.png');

// Ensure folders exist
if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/certificates', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Main endpoint
app.post('/generate', async (req, res) => {
  try {
    const {
      certificateNo,
      studentName,
      regNo,
      Department,
      course,
      college,
      trainingType,
      startDate,
      endDate,
      company
    } = req.body;

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const page = pdfDoc.addPage([595, 842]);

    // Background
    const bgBytes = fs.readFileSync(BG_PATH);
    const bgImage = await pdfDoc.embedPng(bgBytes);
    page.drawImage(bgImage, { x: 0, y: 0, width: 595, height: 842 });

    // Fonts
    const fontBytes = fs.readFileSync(FONT_PATH);
    const boldFontBytes = fs.readFileSync(BOLD_FONT_PATH);
    const font = await pdfDoc.embedFont(fontBytes);
    const boldFont = await pdfDoc.embedFont(boldFontBytes);

    // Title
    const title = trainingType.toUpperCase();
    page.drawText(title, {
      x: (595 - boldFont.widthOfTextAtSize(title, 17)) / 2,
      y: 600,
      size: 17,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    // Certificate Number
    const certText = `Certificate No: ${certificateNo}`;
    const certX = (595 - boldFont.widthOfTextAtSize(certText, 17)) / 2;
    const certY = 560;

    page.drawText(certText, {
      x: certX,
      y: certY,
      size: 17,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    page.drawLine({
      start: { x: certX, y: certY - 2 },
      end: { x: certX + boldFont.widthOfTextAtSize(certText, 17), y: certY - 2 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });

    // Paragraph Writing
const para1 = [
  { text: 'This is to inform that ', bold: false },
  { text: studentName, bold: true },
  { text: ' (Reg no: ', bold: false },
  { text: regNo, bold: true },
  { text: ') ', bold: false },
  { text: Department, bold: true },
  { text: ' and student of ', bold: false },
  { text: college, bold: true },
  { text: ' has attended a ', bold: false },
  { text: course + ' ', bold: true },
  { text: trainingType, bold: true },
  { text: ' in our organization from ', bold: false },
  { text: '(', bold: false },
  { text: startDate, bold: true },
  { text: ') to (', bold: false },
  { text: endDate, bold: true },
  { text: ').', bold: false },
];


    const para2 = [
      { text: 'During this ', bold: false },
      { text: trainingType.toLowerCase(), bold: true },
      { text: ', they gained an understanding of the fundamental concepts of ', bold: false },
      { text: course + '.', bold: true },
    ];

    const writeParagraph = (parts, startY) => {
      const xStart = 80;
      const maxWidth = 440;
      const fontSize = 15;
      let y = startY;
      let line = [];
      let lineWidth = 0;

      const flushLine = () => {
        let x = xStart;
        for (const chunk of line) {
          const usedFont = chunk.bold ? boldFont : font;
          page.drawText(chunk.text, {
            x,
            y,
            size: fontSize,
            font: usedFont,
            color: rgb(0, 0, 0),
          });
          x += usedFont.widthOfTextAtSize(chunk.text, fontSize);
        }
        y -= fontSize + 5;
        line = [];
        lineWidth = 0;
      };

      for (const part of parts) {
        const words = part.text.split(' ');
        for (let i = 0; i < words.length; i++) {
          let word = words[i];
          if (i < words.length - 1) word += ' ';
          const usedFont = part.bold ? boldFont : font;
          const wordWidth = usedFont.widthOfTextAtSize(word, fontSize);
          if (lineWidth + wordWidth > maxWidth) flushLine();
          line.push({ text: word, bold: part.bold });
          lineWidth += wordWidth;
        }
      }

      if (line.length > 0) flushLine();
      return y - 10;
    };

    let y = writeParagraph(para1, 500);
    writeParagraph(para2, y + 5);

    // Signature
    const companyLower = company.toLowerCase();
    let sigFileName = '';
    if (companyLower === 'training trains') sigFileName = 'training_train_sign-removebg-preview.png';
    else if (companyLower === 'domainhostly') sigFileName = 'domainhostly.png';
    else if (companyLower === 'w3appdevelopers') sigFileName = 'w3 app developers sign.png';
    else throw new Error('Invalid company selected');

    const sigPath = path.join(__dirname, 'assets', 'signatures', sigFileName);
    const sigBytes = fs.readFileSync(sigPath);
    const sigImage = await pdfDoc.embedPng(sigBytes);

    page.drawImage(sigImage, {
      x: 400,
      y: 200,
      width: 180,
      height: 60,
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const filePath = path.join(CERT_DIR, `${certificateNo}.pdf`);
    fs.writeFileSync(filePath, pdfBytes);

    // Store in DB
    await Certificate.create({
      certificateNo,
      studentName,
      regNo,
      Department,
      course,
      college,
      trainingType,
      startDate,
      endDate,
      company,
    });

    res.json({ success: true, downloadUrl: `/certificates/${certificateNo}.pdf` });
  } catch (err) {
    console.error("❌ Error generating certificate:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve static PDFs
app.use('/certificates', express.static(CERT_DIR));

// Start server
app.listen(5000, () => {
  console.log("✅ Server running at http://localhost:5000");
});
