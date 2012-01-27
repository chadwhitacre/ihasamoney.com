CREATE TABLE users 
( email                 varchar(64)     PRIMARY KEY
, hash                  char(40)        NOT NULL
, payment_method_token  text            DEFAULT NULL
, paid_through          date            DEFAULT NULL 
, session_token         char(36)        DEFAULT NULL
, session_expires       timestamp       DEFAULT 'now'
, created               timestamp       NOT NULL DEFAULT 'now'
, is_admin              boolean         NOT NULL DEFAULT FALSE
 );

-- Max amount is $999,999,999,999,999.99.
CREATE TABLE transactions 
( id            bigserial       PRIMARY KEY
, email         varchar(64)     REFERENCES users ON DELETE CASCADE
, date          date            NOT NULL
, amount        numeric(15,2)   NOT NULL
, description   text            NOT NULL
 );

CREATE TABLE tags
( id            bigserial   PRIMARY KEY
, email         varchar(64) REFERENCES users ON DELETE CASCADE
, tag           varchar(64) NOT NULL
 );

CREATE TABLE taggings
( id                bigserial   PRIMARY KEY
, transaction_id    bigint      REFERENCES transactions ON DELETE CASCADE
, tag_id            bigint      REFERENCES tags ON DELETE CASCADE
 );


