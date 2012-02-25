-- Create the initial structure.

CREATE OR REPLACE FUNCTION initial_structure() RETURNS void AS $$

    CREATE TABLE users 
    ( email                 varchar(64)     PRIMARY KEY
    , hash                  char(40)        NOT NULL
    , payment_method_token  text            DEFAULT NULL
    , paid_through          date            DEFAULT NULL 
    , session_token         char(36)        DEFAULT NULL
    , session_expires       timestamp       DEFAULT 'now'
    , created               timestamp       NOT NULL DEFAULT 'now'
    , is_admin              boolean         NOT NULL DEFAULT FALSE
    , balance               numeric(15,2)   DEFAULT 0.0
     );

    -- Max amount is $999,999,999,999,999.99.
    CREATE TABLE transactions 
    ( id            bigserial       PRIMARY KEY
    , their_id      varchar(256)    
    , email         varchar(64)     REFERENCES users ON DELETE CASCADE
    , date          date            NOT NULL
    , amount        numeric(15,2)   NOT NULL
    , description   text            NOT NULL
    , UNIQUE (their_id, email)
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

$$ LANGUAGE SQL;


-- Rename "tag" to "category"

CREATE OR REPLACE FUNCTION rename_tag_to_category() RETURNS void AS $$
    ALTER TABLE taggings RENAME to categorizations;
    ALTER TABLE categorizations RENAME COLUMN tag_id TO category_id;
    ALTER TABLE tags RENAME to categories;
    ALTER TABLE categories RENAME COLUMN tag TO category;
$$ LANGUAGE SQL;


-- Keep renaming "tag" to "category"

CREATE OR REPLACE FUNCTION rename_tag_sequence_to_category() RETURNS void AS $$
    ALTER SEQUENCE taggings_id_seq RENAME to categorizations_id_seq;
    ALTER INDEX taggings_pkey RENAME to categorizations_pkey;
    ALTER SEQUENCE tags_id_seq RENAME to categories_id_seq;
    ALTER INDEX tags_pkey RENAME to categories_pkey;
$$ LANGUAGE SQL;


-- Let's get payments in there.

CREATE OR REPLACE FUNCTION define_payments() RETURNS void AS $$
   
    -- Max amount is $999,999,999,999,999.99.
    CREATE TABLE payment_attempts
    ( id            bigserial       PRIMARY KEY
    , email         varchar(64)     REFERENCES users ON DELETE CASCADE
    , timestamp     timestamp       NOT NULL DEFAULT 'now'
    , amount        numeric(15,2)   NOT NULL
    , reference_id  text            DEFAULT NULL
    , problem       text            DEFAULT NULL
     );

$$ LANGUAGE SQL;





-- Now define a wrappers that runs all of the above DDL.

CREATE OR REPLACE FUNCTION build_from_scratch() RETURNS void AS $$
    SELECT initial_structure();
    SELECT rename_tag_to_category();    
    SELECT rename_tag_sequence_to_category();
    SELECT define_payments();
$$ LANGUAGE SQL;
