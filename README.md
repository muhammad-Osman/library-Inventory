# Assessment

## How to run backend

### Step 1
- Create database in postgres
- Create .env file in root of project and copy past the below lines in .env file

```
DATABASE_URL=postgres://username:password@host:db_port/db
PORT=7000
```
- username: postgres
- password: root
- host: localhost
- db_port: 5432
- db: assessment

### Step 2 
- Run the below commands in the root of the project one by one
```
npm i 

npx prisma migrate dev

npm run dev
```

## How to run with Docker
On the root of the folder run below command
```
sudo docker compose up -d --build
```
on the root of folder run below command
## How to stop the docker service
```
sudo docker compose down --remove-orphans
```

