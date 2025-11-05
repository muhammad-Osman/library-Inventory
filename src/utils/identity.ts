import { Request, Response, NextFunction } from 'express';
import { ADMIN_EMAIL, USER_EMAIL_HEADER } from './constants';

type ActorRequest = Request & {
  actor?: {
    email: string;
    isAdmin: boolean;
  };
};

export function identity() {
  return (req: ActorRequest, _res: Response, next: NextFunction) => {
    const email = (req.header(USER_EMAIL_HEADER) || '').trim().toLowerCase();
    if (email) {
      req.actor = {
        email,
        isAdmin: email === ADMIN_EMAIL,
      };
    }
    next();
  };
}
