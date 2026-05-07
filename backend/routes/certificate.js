import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import fs from "fs";
import path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import Certificate from "./models/Certificate.js";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/certificates", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch((err) => console.log("❌ DB Error:", err));

// ✅ API to generate a certificate
app.post("/generate-certificate", async (req, res) => {
  try {
    const { certificateNo, studentName, regNo, course, college, startDate, endDate } = req.body;

    // ✅ Save details in DB
    const cert = new Certificate({
      certificateNo,
      studentName,
      regNo,
      course,
      college,
      startDate,
      endDate
    });
    await cert.save();

    // ✅ Load a blank A4 PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    const { width, height } = page.getSize();

    // ✅ Add background letterpad image
    const letterpadPath = path.resolve("./templates/letterpad.png");
    const imageBytes = fs.readFileSync(letterpadPath);
    const embeddedImage = await pdfDoc.embedPng(imageBytes);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width,
      height
    });

    // ✅ Add fonts
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // ✅ Content
    const content = `
Certificate No: ${certificateNo}

This is to inform that ${studentName} (Reg no: ${regNo}) ${course} and student of ${college} has attended an App Development Internship Training in our organization from (${startDate}) to (${endDate}).

During this internship training, he has gained an understanding of the fundamental concepts of App Development.
`;

    // ✅ Draw text on the PDF
    page.drawText(content, {
      x: 50,
      y: height - 300,
      size: 12,
      font,
      color: rgb(0, 0, 0),
      lineHeight: 18
    });

    // ✅ Save PDF
    const pdfBytes = await pdfDoc.save();
    const outputDir = "./generated/certificates";
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = `${outputDir}/${certificateNo}.pdf`;
    fs.writeFileSync(outputPath, pdfBytes);

    res.json({ message: "✅ Certificate generated!", file: outputPath });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong!" });
  }
});

app.listen(5000, () => console.log("🚀 Server running on port 5000"));
