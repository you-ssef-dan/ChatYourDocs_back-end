// src/config/jwt.ts
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import dotenv from 'dotenv';


dotenv.config();


const privateKeyPath = path.join(__dirname, '..', '..', 'certs', 'private.pem');
const publicKeyPath = path.join(__dirname, '..', '..', 'certs', 'public.pem');


export const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
export const publicKey = fs.readFileSync(publicKeyPath, 'utf8');


export const issuer = process.env.JWT_ISSUER || 'auth-service';
export const expiresMinutes = parseInt(process.env.JWT_EXPIRES_MINUTES || '10', 10);


export function signJwt(payload: object) {
return jwt.sign(payload, privateKey, {
algorithm: 'RS256',
issuer,
expiresIn: `${expiresMinutes}m`,
});
}


export const verifyJwt = promisify<string, jwt.VerifyOptions, object | string>(
(token: string, opts: jwt.VerifyOptions, cb: any) => jwt.verify(token, publicKey, opts, cb)
);