# 0.0.7 / 2016-11-14

* Add initial support for processing messages based on participant role
* Allow un-prefixed response template names in `addResponse` method

# 0.0.6 / 2016-10-24

* Configure build for `initai-node` release

# 0.0.5 / 2016-10-24

* Add entity helper methods
  * `getFirstEntityWithRole`
  * `getEntities`

# 0.0.4 / 2016-09-08

* After a substream (referenced by stream name in a list of steps) terminates, the orignal stream is resumed
* Handle image type messages
* Track stream stack with expectations to resume orignal streams
* Support '/reset' to reset users
* Fix improper checking of length of stream

# 0.0.3 / 2016-08-25

* Introduce package-named prefixes for internal logs

# 0.0.2 / 2016-08-12

* Cleanup package.json

# 0.0.1 / 2016-08-12

* Initial release
