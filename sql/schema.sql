-- Create the initial structure.

CREATE OR REPLACE FUNCTION initial_structure() RETURNS void AS $$

    CREATE TABLE customers
    ( email                 varchar(64)     PRIMARY KEY
    , password_hash         char(40)        NOT NULL

    , payment_method_token  text            DEFAULT NULL
    , day_of_month_to_bill  int             DEFAULT NULL
    , next_bill_date        date            DEFAULT NULL 
    , last_bill_result      text            DEFAULT NULL

    , session_token         char(36)        DEFAULT NULL
    , session_expires       timestamp       DEFAULT CURRENT_TIMESTAMP

    , created               timestamp       NOT NULL DEFAULT CURRENT_TIMESTAMP
    , is_admin              boolean         NOT NULL DEFAULT FALSE

    , balance               numeric(15,2)   DEFAULT 0.0
     );

    -- Max amount is $999,999,999,999,999.99.
    CREATE TABLE transactions 
    ( id            bigserial       PRIMARY KEY
    , their_id      varchar(256)    
    , email         varchar(64)     REFERENCES customers ON DELETE CASCADE
    , date          date            NOT NULL
    , amount        numeric(15,2)   NOT NULL
    , description   text            NOT NULL
    , UNIQUE (their_id, email)
     );

    CREATE TABLE categories
    ( id            bigserial   PRIMARY KEY
    , email         varchar(64) REFERENCES customers ON DELETE CASCADE
    , category      varchar(64) NOT NULL
     );

    CREATE TABLE categorizations 
    ( id                bigserial   PRIMARY KEY
    , transaction_id    bigint      REFERENCES transactions ON DELETE CASCADE
    , category_id       bigint      REFERENCES categories ON DELETE CASCADE
     );

$$ LANGUAGE SQL;


-- Create a referers table.

CREATE OR REPLACE FUNCTION referers() RETURNS void AS $$

    CREATE TABLE referers
    ( id                bigserial   PRIMARY KEY
    , referer           text        NOT NULL
    , date              date        NOT NULL DEFAULT CURRENT_DATE
    , count             bigint      NOT NULL DEFAULT 1
    , UNIQUE (referer, date)
     );

$$ LANGUAGE SQL;
