// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const express = require('express');
const fileUpload = require('express-fileupload');
const Firestore = require('@google-cloud/firestore');
const Promise = require("bluebird");
const {Storage} = require('@google-cloud/storage');
const storage = new Storage();
const path = require('path');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime')
dayjs.extend(relativeTime)

const app = express();
app.use(express.static('public'));
app.use(fileUpload({
    liimits: { fileSize: 10 * 1024 * 1024 },
    useTempFiles : true,
    tempFileDir : '/tmp/'
}))

app.post('/api/pictures', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        console.log("No file uploaded");
        return res.status(400).send('No file was uploaded.');
    }
    console.log(`Receiving file ${JSON.stringify(req.files.picture)}`);

    const newPicture = path.resolve('/tmp', req.files.picture.name);
    const mv = Promise.promisify(req.files.picture.mv);
    await mv(newPicture);
    console.log('File moved in temporary directory');

    const pictureBucket = storage.bucket(process.env.BUCKET_PICTURES);
    await pictureBucket.upload(newPicture, { resumable: false });
    console.log("Uploaded new picture into Cloud Storage");

    res.redirect('/');
});

app.get('/api/pictures', async (req, res) => {
    console.log('Retrieving list of pictures');

    const thumbnails = [];
    const pictureStore = new Firestore().collection('pictures');
    const snapshot = await pictureStore.orderBy('created', 'desc').get();

    if (snapshot.empty) {
        console.log('No pictures found');
    } else {
        snapshot.forEach(doc => {
            const pic = doc.data();
            thumbnails.push({
                name: doc.id,
                labels: pic.labels,
                color: pic.color,
                created: dayjs(pic.created.toDate()).fromNow()
            });
        });
    }
    console.table(thumbnails);
    res.send(thumbnails);
});

app.get('/api/pictures/:name', async (req, res) => {
    res.redirect(`https://storage.cloud.google.com/${process.env.BUCKET_PICTURES}/${req.params.name}`);
});

app.get('/api/thumbnails/:name', async (req, res) => {
    res.redirect(`https://storage.cloud.google.com/${process.env.BUCKET_THUMBNAILS}/${req.params.name}`);
});

app.get('/api/collage', async (req, res) => {
    res.redirect(`https://storage.cloud.google.com/${process.env.BUCKET_THUMBNAILS}/collage.png`);
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`Started web frontend service on port ${PORT}`);
    console.log(`- Pictures bucket = ${process.env.BUCKET_PICTURES}`);
    console.log(`- Thumbnails bucket = ${process.env.BUCKET_THUMBNAILS}`);
});
