import axios from 'axios';
import CryptoJS from 'crypto-js';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();


const baseUrl = 'https://gateway.marvel.com:443/v1/public/';
const privateKey = process.env.PRIVATE_KEY;
const publicKey = process.env.PUBLIC_KEY;
console.log(privateKey)
console.log(publicKey)

async function getCharacterId(characterName) {
    const { ts, hash } = generateTsAndHashAuthentication();

    const searchCharacteresURL = `characters?name=${characterName}&ts=${ts}&apikey=${publicKey}&hash=${hash}`;

    try {
        const response = await axios.get(baseUrl + searchCharacteresURL);
        const thorId = response?.data?.data?.results[0]?.id;
       
        return thorId;
    } catch (error) {
        console.error('Error fetching character ID:', error);
    }
}

async function getComicsByCharacterId(characterId) {
    const limit = 100;
    let offset = 0;
    let total = 0;

    do {
        const { ts, hash } = generateTsAndHashAuthentication();

        try {
            const response = await axios.get(`${baseUrl}comics`, {
                params: {
                    characters: characterId,
                    ts,
                    hash,
                    limit,
                    offset,
                    apikey: publicKey
                }
            });

            const results = response.data.data.results;
            total = response.data.data.total;
            offset += limit;

            const comicsData = results.map(comic => {
                const { title, thumbnail, dates } = comic;
                const coverUrl = `${thumbnail.path}.${thumbnail.extension}`;
                const onsaleDate = dates.find(date => date.type === 'onsaleDate');
                const publicationYear = new Date(onsaleDate.date).getFullYear();

                const validatedPublicationYear = isNaN(publicationYear) ? 'Unknown Publication Year' : publicationYear;
                
                return { title, publicationYear: validatedPublicationYear, coverUrl };
            });

            await writeComicsToCSV(comicsData);
        } catch (error) {
            console.error('Error fetching comics:', error);
        }
    } while (offset < total);
}

function generateTsAndHashAuthentication() {
    const ts = Date.now();
    const hash = CryptoJS.MD5(ts + privateKey + publicKey).toString();

    return {
        ts, hash
    };
}

async function writeComicsToCSV(comicsData) {
    const csvWriter = createObjectCsvWriter({
        path: 'comics.csv',
        header: [
            { id: 'title', title: 'Title' },
            { id: 'publicationYear', title: 'Publication Year' },
            { id: 'coverUrl', title: 'Cover URL' }
        ],
        append: fs.existsSync('comics.csv')
    });

    if (!fs.existsSync('comics.csv')) {
        await csvWriter.writeRecords([]); //To write the headers of the file
    }

    try {
        await csvWriter.writeRecords(comicsData);
        console.log('Data appended to CSV file successfully');
    } catch (error) {
        console.error('Error writing to CSV:', error);
    }
}

async function main() {
    const characterId = await getCharacterId('Thor');
    if (characterId) {
        await getComicsByCharacterId(characterId);
    } else {
        console.error('Failed to retrieve character ID. Aborting comic fetch.');
    }
}

main();
